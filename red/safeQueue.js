/*
   Copyright 2017 Smart-Tech Controle e Automação

   Licensed under the Apache License, Version 2.0 (the "License");
   you may not use this file except in compliance with the License.
   You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

   Unless required by applicable law or agreed to in writing, software
   distributed under the License is distributed on an "AS IS" BASIS,
   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
   See the License for the specific language governing permissions and
   limitations under the License.
*/

const FileSystem = require('../src/FileSystem.js');

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {
        var node = this;

        this.name = config.name;

        this.listNodeOut = [];

        this.virtualQueue = new Map();
        this.messageProccess = new Map();

        this.stopProccess = false;
        this.initProccess = false;

        this.timeOut = config.timeoutAck;

        if (this.timeOut.length == 0) {
            this.timeOut = 1000;
        }

        this.storageMode = config.storage;


        this.autoStartJob = config.startJob;

        let infoPath = {'path': config.path};

        if (this.storageMode == 'fs') {
            this.storage = new FileSystem(infoPath);
        } else {
            node.error("Error in node configuration.");
            return;
        }

        RED.nodes.createNode(this, config);

        this.storage.on('newMessage', () => {
            node.proccessQueue();
        });

        this.storage.init((err) => {
            if (err) {
                return;
            }

            if (this.autoStartJob) {
                node.startMessages();
            }

        });

        node.startMessages = function startMessages() {

            node.initProccess = true;

            if (node.virtualQueue.size > 0) {
                for (var key of node.virtualQueue.keys()) {
                    node.virtualQueue.delete(key);
                }
            }

            if (node.messageProccess.size > 0) {
                for (var key of node.messageProccess.keys()) {
                    node.messageProccess.delete(key);
                }
            }

            this.storage.getMessageList((err, list) => {
                if (err) {
                    return;
                }

                list.forEach((item) => {
                    this.storage.getMessage(item, (err, data) => {
                        if (err) {
                            return;
                        }

                        let itemQueue = {};
                        itemQueue.keyMessage = data.keyMessage;
                        itemQueue.inProccess = false;
                        itemQueue.nodeOut = null;
                        itemQueue.timer = null;

                        let itemMessage = {};
                        itemMessage.keyMessage = data.message._msgid;
                        itemMessage.message = data.message;

                        this.virtualQueue.set(itemQueue.keyMessage, itemQueue);
                        this.messageProccess.set(itemMessage.keyMessage, itemMessage);

                        node.proccessQueue();
                    });
                });
            });
        }

        //---> Functions <---
        node.receiveMessage = function receiveMessage(message, callback) {

            if(!node.initProccess){
                node.startMessages();
            }

            let itemQueue = {};
            itemQueue.keyMessage = message._msgid;
            itemQueue.inProccess = false;
            itemQueue.nodeOut = null;
            itemQueue.timer = null;

            let itemMessage = {};
            itemMessage.keyMessage = message._msgid;
            itemMessage.message = message;

            this.virtualQueue.set(itemQueue.keyMessage, itemQueue);
            this.messageProccess.set(itemMessage.keyMessage, itemMessage);

            this.storage.saveMessage(itemMessage, (err) => {
                callback(err);
            });
        }

        node.proccessQueue = function proccessQueue() {

            var nodeOut = node.getNodeOut();

            if (nodeOut == null) {
                return;
            }

            var keyItemQueue = node.getMessageProccess();

            if (keyItemQueue == null) {
                return;
            }

            let itemQueue = this.virtualQueue.get(keyItemQueue);

            itemQueue.inProccess = true;
            itemQueue.nodeOut = nodeOut;

            this.virtualQueue.set(itemQueue.keyMessage, itemQueue);

            let message = {};

            itemQueue.timer = setTimeout(node.onError, this.timeOut, itemQueue.keyMessage);
            nodeOut.setOutInProccess();

            if (this.messageProccess.has(itemQueue.keyMessage)) {
                message = this.messageProccess.get(itemQueue.keyMessage);
                nodeOut.sendMessage(message);
            } else {
                this.storage.getMessage(itemQueue.keyMessage, (err, data) => {
                    if (err) {
                        return;
                    }

                    message = data;
                    nodeOut.sendMessage(message);
                });
            }
        }

        node.getNodeOut = function getNodeOut() {

            if (node.stopProccess) {
                this.listNodeOut.forEach(out => {
                    if (!out.outInProccess) {
                        out.setOutStopProccess();
                    }
                });

                return null;
            }

            return this.listNodeOut.find(out => {
                if (!out.outInProccess) {
                    return out;
                }
            });
        }

        node.getMessageProccess = function getMessageProccess() {
            for (var [key, value] of this.virtualQueue.entries()) {
                if (!value.inProccess) {
                    return key;
                }
            }
            return null;
        }

        node.onError = function onError(keyMessage) {

            let itemQueue = node.virtualQueue.get(keyMessage);

            node.warn(`Fail to proccess message ${itemQueue.keyMessage}`);

            itemQueue.nodeOut.setOutFree();
            clearTimeout(itemQueue.timer);

            if (node.stopProccess) {
                itemQueue.nodeOut.setOutStopProccess();
            }

            node.messageProccess.delete(itemQueue.keyMessage);
            node.virtualQueue.delete(itemQueue.keyMessage);

            node.storage.errorMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                    return;
                }

                node.proccessQueue();

            });
        }

        node.onSuccess = function onSuccess(keyMessage) {

            let itemQueue = this.virtualQueue.get(keyMessage);

            itemQueue.nodeOut.setOutFree();
            clearTimeout(itemQueue.timer);

            if (node.stopProccess) {
                itemQueue.nodeOut.setOutStopProccess();
            }
            node.messageProccess.delete(itemQueue.keyMessage);
            node.virtualQueue.delete(itemQueue.keyMessage);

            node.storage.doneMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                    return;
                }
                node.proccessQueue();
            });
        }

        node.registerOut = function registerOut(nodeOut) {
            this.listNodeOut.push(nodeOut);
        }
        //---> Functions <---

        //--> Function Storage <--
        node.deleteDone = function deleteDone(days, callback) {
            this.storage.deleteDone(days, callback);
        }

        node.deleteError = function deleteError(days, callback) {
            this.storage.deleteError(days, callback);
        }

        node.resendErrors = function resendErrors(days, callback) {
            this.storage.resendErrors(days, callback);
        }

        node.getQueueSize = function getQueueSize(callback) {
            this.storage.getQueueSize(callback);
        }

        node.getDoneSize = function getDoneSize(callback) {
            this.storage.getDoneSize(callback);
        }

        node.getErrorSize = function getErrorSize(callback) {
            this.storage.getErrorSize(callback);
        }
        //--> Function Storage <--
    }

    RED.nodes.registerType("queue config", SafeQueueConfig);

// ------------- SafeQueue In (queue in) ------------
    function SafeQueueIn(values) {

        var node = this;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.on('input', function (msg) {

            node.status({
                fill: "blue",
                shape: "dot",
                text: "new data"
            });


            node.config.receiveMessage(msg, (err) => {
                if (err) {
                    msg.error = err;

                    node.error(msg.error);

                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "error"
                    });

                    return;
                }

                node.send(msg);
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "done"
                });
            });
        });
    }

    RED.nodes.registerType("queue in", SafeQueueIn);

// ------------- SafeQueue Out (queue out) ------------
    function SafeQueueOut(values) {

        var node = this;

        this.outInProccess = false;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.config.registerOut(node);

        node.setOutStopProccess = function setOutStopProccess() {
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "stop proccess"
            });
        }

        node.setOutInProccess = function setOutInProccess() {
            this.outInProccess = true;
            node.status({
                fill: "red",
                shape: "dot",
                text: "proccess"
            });
        }

        node.setOutFree = function setOutFree() {
            this.outInProccess = false;
            node.status({
                fill: "green",
                shape: "dot",
                text: "free"
            });
        }

        node.sendMessage = function sendMessage(message) {
            node.send(message);
        }
    }

    RED.nodes.registerType("queue out", SafeQueueOut);

// ------------- SafeQueue Control (queue control) ------------
    function SafeQueueControl(values) {

        var node = this;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.on('input', function (msg) {

            //console.log(values.operation);

            var operation = values.operation;

            if (operation === 'queue-size') {

                node.config.getQueueSize(function (error, results) {

                    if (!error) {
                        var size = results;

                        node.status({
                            fill: "blue",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                        node.send(msg);

                    } else {
                        node.error(error);
                    }
                });
            }

            if (operation === 'done-size') {

                node.config.getDoneSize(function (error, results) {

                    if (!error) {

                        var size = results;

                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                        node.send(msg);

                    } else {
                        node.error(error);
                    }
                });
            }

            if (operation === 'error-size') {

                node.config.getErrorSize(function (error, results) {

                    if (!error) {
                        var size = results;
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                        node.send(msg);

                    } else {
                        node.error(error);
                    }
                });
            }

            if (operation === 'delete-error') {
                node.config.deleteError(null, (err) => {
                    if (err) {
                        node.error(err);
                        return;
                    }

                    msg.payload = true;
                    node.send(msg);
                });
            }

            if (operation === 'delete-done') {
                node.config.deleteDone(null, (err, results) => {
                    if (err) {
                        node.error(err);
                        return;
                    }

                    msg.payload = true;
                    node.send(msg);
                });
            }

            if (operation === 'resend-errors') {

                if (node.config.getStopProccess()) {
                    node.config.resendErrors(function (err, results) {
                        msg.payload = results;

                        if (err) {
                            node.error(err);
                        } else {
                            node.config.init();
                        }
                        node.send(msg);
                    });
                } else {
                    msg.payload = "Process is not stopped";
                    node.warn("resendErrors - Process is not stopped");
                    node.send(msg);
                }
            }

            if (operation === 'start-proccess') {

                node.config.stopProccess = false;

                node.config.listNodeOut.forEach(out => {
                    out.setOutFree();
                });

                node.config.startMessages();

                node.log("Start proccess");
                msg.payload = "Start proccess";
                node.send(msg);
            }

            if (operation === 'stop-proccess') {
                node.config.stopProccess = true;

                node.log("Stop Outputs");
                msg.payload = "Stop Outputs";
                node.send(msg);
            }
        });
    }

    RED.nodes.registerType("queue control", SafeQueueControl);

// ------------- SafeQueue Acknowledge (queue ack) ------------
    function SafeQueueAcknowledge(values) {

        var node = this;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.on('input', function (msg) {
            if (msg.error) {
                node.config.onError(msg.keyMessage);
                return;
            }
            node.config.onSuccess(msg.keyMessage);
        });
    }

    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};
