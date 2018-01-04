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

        RED.nodes.createNode(node, config);

        var equalPath = false;

        RED.nodes.eachNode((nodes) => {

            if(nodes.type == 'queue config'){

                if(config.id === nodes.id){
                    return;
                }

                if(config.path === nodes.path){
                    node.error("Path in use. Path: " + config.path );            
                    equalPath = true;
                }
            }            
        });

        if(equalPath){
            node.error("Path in use. Path: " + config.path );
            return;
        }

        this.name = config.name;

        this.listNodeOut = [];

        this.virtualQueue = new Map();
        this.messageProcess = new Map();

        this.stopProcess = false;
        this.initProcess = false;

        this.onClose = false;

        this.timeOut = config.timeoutAck;

        this.storageMode = config.storage;

        this.autoStartJob = config.startJob;

        let infoPath = {
            'path': config.path
        };

        if (this.storageMode == 'fs') {
            this.storage = new FileSystem(infoPath);
        } else {
            node.error("Error in node configuration.");
            return;
        }

        node.on('close', (done) => {

            node.onClose = true;

            this.virtualQueue.forEach((value, key) => {
                clearTimeout(value.timer);
            });

            this.virtualQueue.clear();
            this.messageProcess.clear();

            node.storage.close();

            done();
        });

        this.storage.on('newMessage', () => {
            node.processQueue();
        });

        this.storage.init((err) => {
            if (err) {
                return;
            }

            if (this.autoStartJob) {
                node.startMessages();
                return;
            }

            this.listNodeOut.forEach(out => {
                if (!out.outInProcess) {
                    out.setOutStopProcess();
                }
            });

        });

        node.startMessages = function startMessages() {

            node.initProcess = true;

            if (node.virtualQueue.size > 0) {
                node.virtualQueue.clear();
            }

            if (node.messageProcess.size > 0) {
                node.messageProcess.clear();
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
                        itemQueue.inProcess = false;
                        itemQueue.nodeOut = null;
                        itemQueue.timer = null;

                        let itemMessage = {};
                        itemMessage.keyMessage = data.message._msgid;
                        itemMessage.message = data.message;

                        this.virtualQueue.set(itemQueue.keyMessage, itemQueue);
                        this.messageProcess.set(itemMessage.keyMessage, itemMessage);

                        node.processQueue();
                    });
                });
            });
        }

        //---> Functions <---
        node.receiveMessage = function receiveMessage(message, callback) {
            let itemQueue = {};
            itemQueue.keyMessage = message._msgid;
            itemQueue.inProcess = false;
            itemQueue.nodeOut = null;
            itemQueue.timer = null;

            let itemMessage = {};
            itemMessage.keyMessage = message._msgid;
            itemMessage.message = message;

            this.virtualQueue.set(itemQueue.keyMessage, itemQueue);
            this.messageProcess.set(itemMessage.keyMessage, itemMessage);

            this.storage.saveMessage(itemMessage, (err) => {
                callback(err);
            });
        }

        node.processQueue = function processQueue() {

            if (node.onClose) {
                return;
            }

            var nodeOut = node.getNodeOut();

            if (nodeOut == null) {
                return;
            }

            var keyItemQueue = node.getMessageProcess();

            if (keyItemQueue == null) {
                return;
            }

            let itemQueue = this.virtualQueue.get(keyItemQueue);

            itemQueue.inProcess = true;
            itemQueue.nodeOut = nodeOut;

            this.virtualQueue.set(itemQueue.keyMessage, itemQueue);

            let message = {};

            if (this.timeOut != 0) {
                itemQueue.timer = setTimeout(node.onError, this.timeOut, itemQueue.keyMessage);
            }


            nodeOut.setOutInProcess();

            if (this.messageProcess.has(itemQueue.keyMessage)) {
                message = this.messageProcess.get(itemQueue.keyMessage);
                nodeOut.sendMessage(message.message);
            } else {
                this.storage.getMessage(itemQueue.keyMessage, (err, data) => {
                    if (err) {
                        return;
                    }

                    let itemMessage = {};
                    itemMessage.keyMessage = message._msgid;
                    itemMessage.message = message.message;

                    this.messageProcess.set(itemMessage.keyMessage, itemMessage);

                    message = data;
                    nodeOut.sendMessage(message.message);
                });
            }
        }

        node.getNodeOut = function getNodeOut() {

            //Fuction set stop outputs and return null for stop processQueue()
            if (node.stopProcess) {
                this.listNodeOut.forEach(out => {
                    if (!out.outInProcess) {
                        out.setOutStopProcess();
                    }
                });
                return null;
            }

            return this.listNodeOut.find(out => {
                if (!out.outInProcess) {
                    return out;
                }
            });
        }

        node.getMessageProcess = function getMessageProcess() {
            for (var [key, value] of this.virtualQueue.entries()) {
                if (!value.inProcess) {
                    return key;
                }
            }
            return null;
        }

        node.onError = function onError(keyMessage) {

            if (node.onClose) {
                return;
            }

            let itemQueue = node.virtualQueue.get(keyMessage);

            if (!itemQueue) {
                return;
            }

            node.warn(`${RED._("safe-queue.message-errors.fail-message-process")}: ${itemQueue.keyMessage}`);

            itemQueue.nodeOut.setOutFree();

            if (this.timeOut != 0) {
                clearTimeout(itemQueue.timer);
            }

            if (node.stopProcess) {
                itemQueue.nodeOut.setOutStopProcess();
            }

            node.messageProcess.delete(itemQueue.keyMessage);
            node.virtualQueue.delete(itemQueue.keyMessage);

            node.storage.errorMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                }

                node.processQueue();

            });
        }

        node.onSuccess = function onSuccess(keyMessage) {

            if (node.onClose) {
                return;
            }

            let itemQueue = this.virtualQueue.get(keyMessage);

            if (!itemQueue) {
                return;
            }

            itemQueue.nodeOut.setOutFree();

            if (this.timeOut != 0) {
                clearTimeout(itemQueue.timer);
            }

            if (node.stopProcess) {
                itemQueue.nodeOut.setOutStopProcess();
            }
            node.messageProcess.delete(itemQueue.keyMessage);
            node.virtualQueue.delete(itemQueue.keyMessage);

            node.storage.doneMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                }
                node.processQueue();
            });
        }

        node.registerOut = function registerOut(nodeOut) {
            this.listNodeOut.push(nodeOut);
        }

        node.allOutNodeStopped = function allOutNodeStopped() {

            var inStop = true;

            this.listNodeOut.forEach(out => {
                if (!out.outInStop) {
                    inStop = false;
                }
            });

            return inStop;
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

                    if (values.sendError) {
                        node.send(msg);
                    }

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

        this.outInProcess = false;
        this.outInStop = false;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.config.registerOut(node);

        node.setOutStopProcess = function setOutStopProcess() {
            this.outInStop = true;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "stop process"
            });
        }

        node.setOutInProcess = function setOutInProcess() {
            this.outInProcess = true;
            node.status({
                fill: "blue",
                shape: "dot",
                text: "process"
            });
        }

        node.setOutFree = function setOutFree() {
            this.outInStop = false;
            this.outInProcess = false;
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

        this.days = values.days;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.on('input', function (msg) {

            var operation = values.operation;

            switch (operation) {
                case 'queue-size':
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

                    break;

                case 'done-size':
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

                    break;

                case 'error-size':
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

                    break;

                case 'delete-error':
                    node.config.deleteError(this.days, (err) => {
                        if (err) {
                            node.error(err);
                            return;
                        }

                        msg.payload = true;
                        node.send(msg);
                    });

                    break;

                case 'delete-done':
                    node.config.deleteDone(this.days, (err, results) => {
                        if (err) {
                            node.error(err);
                            return;
                        }

                        msg.payload = true;
                        node.send(msg);
                    });

                    break;

                case 'resend-errors':
                    node.config.resendErrors(this.days, (err) => {
                        if (err) {
                            return;
                        }
                        node.config.startMessages();
                    });

                    break;

                case 'start-process':

                    if (!node.config.allOutNodeStopped()) {
                        node.warn(RED._("safe-queue.message-log.out-process"));
                        return;
                    }

                    node.config.stopProcess = false;

                    node.config.listNodeOut.forEach(out => {
                        out.setOutFree();
                    });

                    node.config.startMessages();

                    node.log(RED._("safe-queue.message-log.start-process"));

                    node.send(msg);

                    break;

                case 'stop-process':

                    node.config.stopProcess = true;

                    node.config.listNodeOut.forEach(out => {
                        if (!out.outInProcess) {
                            out.setOutStopProcess();
                        }
                    });

                    node.log(RED._("safe-queue.message-log.stop-output"));

                    node.send(msg);
                    break;

                default:
                    node.warn(RED._("safe-queue.message-errors.no-operation"));
                    break;
            }
        });
    }

    RED.nodes.registerType("queue control", SafeQueueControl);

    // ------------- SafeQueue Acknowledge (queue ack) ------------
    function SafeQueueAcknowledge(values) {

        var node = this;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.on('input', function (msg) {
            if (msg.error) {
                node.config.onError(msg._msgid);
                return;
            }
            node.config.onSuccess(msg._msgid);
        });
    }

    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};