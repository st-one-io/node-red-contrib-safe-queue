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

function generateUUID() {
    let d = new Date().getTime();
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
};

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {

        var node = this;

        RED.nodes.createNode(this, config);

        var equalPath = false;

        RED.nodes.eachNode((nodes) => {

            if (nodes.type == 'queue config') {

                if (config.id === nodes.id) {
                    return;
                }

                if (config.path === nodes.path) {
                    node.error("Path in use. Path: " + config.path);
                    equalPath = true;
                }
            }
        });

        if (equalPath) {
            node.error("Path in use. Path: " + config.path);
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

        this.typeTimeout = config.typeTimeout;

        this.typeError = config.typeError;

        this.retryTimeout = config.retryTimeout;

        this.retryError = config.retryError;

        let infoPath = {
            'path': config.path
        };

        if (node.storageMode == 'fs') {
            node.storage = new FileSystem(infoPath);
        } else {
            node.error("Error in node configuration.");
            return;
        }

        node.on('close', (done) => {

            node.onClose = true;

            node.virtualQueue.forEach((value, key) => {
                clearTimeout(value.timer);
            });

            node.virtualQueue.clear();
            node.messageProcess.clear();

            node.storage.close();

            done();
        });

        node.storage.on('newMessage', () => {
            node.processQueue();
        });

        node.storage.init((err) => {
            if (err) {
                return;
            }

            if (node.autoStartJob) {
                node.startMessages();
                return;
            }

            node.listNodeOut.forEach(out => {
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

            node.storage.getMessageList((err, list) => {
                if (err) {
                    return;
                }

                list.forEach((item) => {
                    node.storage.getMessage(item, (err, data) => {
                        if (err) {
                            return;
                        }

                        let itemQueue = {};
                        itemQueue.keyMessage = data.keyMessage;
                        itemQueue.inProcess = false;
                        itemQueue.nodeOut = null;
                        itemQueue.timer = null;
                        itemQueue.resend = 0; //Atualização para reenvio automatico

                        let itemMessage = {};
                        itemMessage.keyMessage = data.message.uuid;
                        itemMessage.message = data.message;

                        node.virtualQueue.set(itemQueue.keyMessage, itemQueue);
                        node.messageProcess.set(itemMessage.keyMessage, itemMessage);

                        node.processQueue();
                    });
                });
            });
        }

        //---> Functions <---
        node.receiveMessage = function receiveMessage(message, callback) {

            //A keyMessage das mensagens passa a ser um uuid.
            //o uuid é passada em msg.uuid

            let newID = generateUUID();

            message.uuid = newID;

            let itemQueue = {};
            itemQueue.keyMessage = newID;
            itemQueue.inProcess = false;
            itemQueue.nodeOut = null;
            itemQueue.timer = null;
            itemQueue.resend = 0; //Atualização para reenvio automatico

            let itemMessage = {};
            itemMessage.keyMessage = newID;
            itemMessage.message = message;

            node.virtualQueue.set(itemQueue.keyMessage, itemQueue);
            node.messageProcess.set(itemMessage.keyMessage, itemMessage);

            node.storage.saveMessage(itemMessage, (err) => {
                callback(err);
            });
        }

        node.processQueue = function processQueue() {

            if (node.onClose) {
                return;
            }

            var nodeOut = node.getNodeOut();

            if (!nodeOut) {
                return;
            }

            var keyItemQueue = node.getMessageProcess();

            if (!keyItemQueue) {
                return;
            }

            let itemQueue = node.virtualQueue.get(keyItemQueue);

            itemQueue.inProcess = true;
            itemQueue.nodeOut = nodeOut;

            node.transmitMessage(itemQueue);
        }

        node.transmitMessage = function transmitMessage(itemQueue) {

            if (node.timeOut != 0) {

                let obj = {
                    item: itemQueue.keyMessage,
                    origin: "timeout"
                };

                itemQueue.timer = setTimeout(node.onError, node.timeOut, obj);
            }

            itemQueue.nodeOut.setOutInProcess();

            if (node.messageProcess.has(itemQueue.keyMessage)) {
                let message = node.messageProcess.get(itemQueue.keyMessage);
                itemQueue.nodeOut.sendMessage(message.message);
            } else {
                node.storage.getMessage(itemQueue.keyMessage, (err, data) => {
                    if (err) {
                        node.error(`${RED._("safe-queue.message-errors.fail-read-message")}: ${itemQueue.keyMessage}`);
                        return;
                    }

                    let itemMessage = {};
                    itemMessage.keyMessage = data.uuid;
                    itemMessage.message = data.message;

                    node.messageProcess.set(itemMessage.keyMessage, itemMessage);

                    itemQueue.nodeOut.sendMessage(data.message);
                });
            }
        }

        node.getNodeOut = function getNodeOut() {

            //Fuction set stop outputs and return null for stop processQueue()
            if (node.stopProcess) {
                node.listNodeOut.forEach(out => {
                    if (!out.outInProcess) {
                        out.setOutStopProcess();
                    }
                });
                return null;
            }

            return node.listNodeOut.find(out => {
                if (!out.outInProcess) {
                    return out;
                }
            });
        }

        node.getMessageProcess = function getMessageProcess() {
            for (var [key, value] of node.virtualQueue.entries()) {
                if (!value.inProcess) {
                    return key;
                }
            }
            return null;
        }

        node.onError = function onError(obj) {

            let keyMessage = obj.item;
            let origin = obj.origin;

            if (node.onClose) {
                return;
            }

            let itemQueue = node.virtualQueue.get(keyMessage);

            if (!itemQueue) {
                return;
            }

            node.warn(`${RED._("safe-queue.message-errors.fail-message-process")}: ${itemQueue.keyMessage} - ${origin}`);

            clearTimeout(itemQueue.timer);


            if (origin == "timeout") {
                switch (node.typeTimeout) {

                    case 'retry-times':
                        itemQueue.resend++;

                        if (itemQueue.resend <= node.retryTimeout) {
                            node.transmitMessage(itemQueue);
                            return;
                        }

                        break;

                    case 'retry-infinite':

                        node.transmitMessage(itemQueue);
                        return;

                        break;

                    case 'move-error':
                        break;
                }
            }

            if (origin == "error") {

                switch (node.typeError) {

                    case 'retry-times':
                        itemQueue.resend++;

                        if (itemQueue.resend <= node.retryError) {
                            node.transmitMessage(itemQueue);
                            return;
                        }

                        break;

                    case 'retry-infinite':

                        node.transmitMessage(itemQueue);
                        return;

                        break;

                    case 'move-error':
                        break;

                }
            }

            if (itemQueue.nodeOut) {
                itemQueue.nodeOut.setOutFree();

                if (node.stopProcess) {
                    itemQueue.nodeOut.setOutStopProcess();
                }
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

            let itemQueue = node.virtualQueue.get(keyMessage);

            if (!itemQueue) {
                return;
            }

            clearTimeout(itemQueue.timer);

            if (itemQueue.nodeOut) {
                itemQueue.nodeOut.setOutFree();

                if (node.stopProcess) {
                    itemQueue.nodeOut.setOutStopProcess();
                }
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
            node.listNodeOut.push(nodeOut);
        }

        node.allOutNodeStopped = function allOutNodeStopped() {

            var inStop = true;

            node.listNodeOut.forEach(out => {
                if (!out.outInStop) {
                    inStop = false;
                }
            });

            return inStop;
        }
        //---> Functions <---

        //--> Function Storage <--
        node.deleteDone = function deleteDone(days, callback) {
            node.storage.deleteDone(days, callback);
        }

        node.deleteError = function deleteError(days, callback) {
            node.storage.deleteError(days, callback);
        }

        node.resendErrors = function resendErrors(days, callback) {
            node.storage.resendErrors(days, callback);
        }

        node.getQueueSize = function getQueueSize(callback) {
            node.storage.getQueueSize(callback);
        }

        node.getDoneSize = function getDoneSize(callback) {
            node.storage.getDoneSize(callback);
        }

        node.getErrorSize = function getErrorSize(callback) {
            node.storage.getErrorSize(callback);
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

        node.outInProcess = false;
        node.outInStop = false;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.config.registerOut(node);

        node.setOutStopProcess = function setOutStopProcess() {
            node.outInStop = true;
            node.status({
                fill: "yellow",
                shape: "dot",
                text: "stop process"
            });
        }

        node.setOutInProcess = function setOutInProcess() {
            node.outInProcess = true;
            node.status({
                fill: "blue",
                shape: "dot",
                text: "process"
            });
        }

        node.setOutFree = function setOutFree() {
            node.outInStop = false;
            node.outInProcess = false;
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

        node.days = values.days;

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
                    node.config.deleteError(node.days, (err) => {
                        if (err) {
                            node.error(err);
                            return;
                        }

                        msg.payload = true;
                        node.send(msg);
                    });

                    break;

                case 'delete-done':
                    node.config.deleteDone(node.days, (err, results) => {
                        if (err) {
                            node.error(err);
                            return;
                        }

                        msg.payload = true;
                        node.send(msg);
                    });

                    break;

                case 'resend-errors':
                    node.config.resendErrors(node.days, (err) => {
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

        //Safe-Queue não utiliza mais o msg._msgid para identificação da mensagem
        //agora utiliza msg.uuid

        node.on('input', function (msg) {
            if (msg.error) {

                let obj = {
                    item: msg.uuid,
                    origin: "error"
                };

                node.config.onError(obj);
                return;
            }
            node.config.onSuccess(msg.uuid);
        });
    }

    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};