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
/* jshint node: true, esversion: 6 */


const FileSystem = require('../src/FileSystem.js');

function generateUUID() {
    let d = new Date().getTime();
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        let r = (d + Math.random() * 16) % 16 | 0;
        d = Math.floor(d / 16);
        return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;
}

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {

        var node = this;

        RED.nodes.createNode(this, config);

        var samePath = false;

        //check if we have multiple 'queue config' nodes with the same path configured
        RED.nodes.eachNode((nodes) => {

            if (nodes.type == 'queue config') {

                if (config.id === nodes.id) {
                    return;
                }

                if (config.path === nodes.path) {
                    node.error(RED._("safe-queue.messages.path-in-use") + config.path);
                    samePath = true;
                }
            }
        });

        if (samePath) {
            //TODO: remove, the error was already logged above
            // node.error("Path in use. Path: " + config.path);
            return;
        }
        
        this.virtualQueue = new Map();
        this.messageCache = new Map();
        this.listNodeOut = [];
        this.closing = false;
        this.initialized = false;
        
        this.name = config.name;
        this.timeOut = config.timeoutAck;
        this.storageMode = config.storage;
        this.typeTimeout = config.typeTimeout;
        this.typeError = config.typeError;
        this.retryTimeout = config.retryTimeout;
        this.retryError = config.retryError;
        this.maxInMemory = config.maxInMemory;

        // `this.running` also holds if we should start 
        // the node processing the queue or not
        this.running = !!config.startJob;

        let infoPath = {
            'path': config.path
        };

        if (node.storageMode == 'fs') {
            node.storage = new FileSystem(infoPath);
        } else {
            node.error(RED._("safe-queue.messages.error-not-storage"));
            return;
        }

        node.on('close', (done) => {

            node.closing = true;

            node.virtualQueue.forEach((value, key) => {
                clearTimeout(value.timer);
            });

            node.virtualQueue.clear();
            node.messageCache.clear();

            node.storage.close();

            done();
        });

        node.storage.on('newMessage', () => {
            node.processQueue();
        });

        node.updateMessageList = function updateMessageList(cb){
            node.storage.getMessageList((err, list) => {
                if (err) {
                    cb(err);
                }

                for (let item of list) {

                    if (!node.virtualQueue.has(item)){
                        //skip items that are already on the list
                        //they may be currently in process!
                        continue;
                    }

                    let itemQueue = {};
                    itemQueue.keyMessage = item;
                    itemQueue.inProcess = false;
                    itemQueue.nodeOut = null;
                    itemQueue.timer = null;
                    itemQueue.resend = 0; //Atualização para reenvio automatico

                    node.virtualQueue.set(itemQueue.keyMessage, itemQueue);
                }

                cb(null);
            });
        };

        node.storage.init((err) => {
            if (err) {
                return; //TODO handle error!!
            }

            node.updateMessageList(err => {
                if(err){
                    return; //TODO handle error
                }

                node.initialized = true;

                if (node.running) {
                    node.startProcess();
                }
            });
        });

        node.startProcess = function startProcess() {
            node.log(RED._("safe-queue.message-log.start-process"));

            node.running = true;
            node.processQueue();
        };

        node.stopProcess = function stopProcess() {
            node.log(RED._("safe-queue.message-log.stop-output"));
            node.running = false;
        };

        //---> Functions <---
        node.receiveMessage = function receiveMessage(message, callback) {

            //generate an UUID for each incoming message
            let newID = generateUUID();

            message.uuid = newID;

            let itemQueue = {};
            itemQueue.keyMessage = newID;
            itemQueue.inProcess = false;
            itemQueue.nodeOut = null;
            itemQueue.timer = null;
            itemQueue.resend = 0; //Atualização para reenvio automatico
            node.virtualQueue.set(itemQueue.keyMessage, itemQueue);

            let itemMessage = {};
            itemMessage.keyMessage = newID;
            itemMessage.message = message;

            if (node.messageCache.size < node.maxInMemory || node.maxInMemory == 0) {
                node.messageCache.set(itemMessage.keyMessage, itemMessage);
            }

            node.storage.saveMessage(itemMessage, (err) => {
                callback(err);
                node.processQueue();
            });
        };

        node.processQueue = function processQueue() {

            if (node.closing || !node.running || !node.initialized) {
                return;
            }

            var nodeOut = node.getNodeOut();

            if (!nodeOut) {
                return;
            }

            var itemQueue = node.getNextMessage();

            if (!itemQueue) {
                return;
            }

            itemQueue.inProcess = true;
            itemQueue.nodeOut = nodeOut;

            node.transmitMessage(itemQueue);
        };

        node.transmitMessage = function transmitMessage(itemQueue) {

            if (node.timeOut != 0) {

                let obj = {
                    item: itemQueue.keyMessage,
                    origin: "timeout"
                };

                itemQueue.timer = setTimeout(node.onError, node.timeOut, obj);
            }

            itemQueue.nodeOut.setOutInProcess();

            if (node.messageCache.has(itemQueue.keyMessage)) {
                let message = node.messageCache.get(itemQueue.keyMessage);
                itemQueue.nodeOut.sendMessage(message.message);
            } else {
                node.storage.getMessage(itemQueue.keyMessage, (err, data) => {
                    if (err) {
                        node.error(`${RED._("safe-queue.message-errors.fail-read-message")}: ${itemQueue.keyMessage}`);
                        // let the timeout above handle the issue
                        return;
                    }

                    let itemMessage = {};
                    itemMessage.keyMessage = data.uuid;
                    itemMessage.message = data.message;

                    node.messageCache.set(itemMessage.keyMessage, itemMessage);

                    itemQueue.nodeOut.sendMessage(data.message);
                });
            }
        };

        node.getNodeOut = function getNodeOut() {
            return node.listNodeOut.find(out => {
                if (!out.outInProcess) {
                    return out;
                }
            });
        };

        node.getNextMessage = function getNextMessage() {
            for (var [key, value] of node.virtualQueue.entries()) {
                if (!value.inProcess) {
                    return value;
                }
            }
            return null;
        };

        node.onError = function onError(obj) {

            let keyMessage = obj.item;
            let origin = obj.origin;

            if (node.closing) {
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

                    case 'move-error':
                        break;

                }
            }

            if (itemQueue.nodeOut) {
                itemQueue.nodeOut.setOutFree();
            }

            node.messageCache.delete(itemQueue.keyMessage);
            node.virtualQueue.delete(itemQueue.keyMessage);

            node.storage.errorMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                }

                node.processQueue();
            });
        };

        node.onSuccess = function onSuccess(keyMessage) {

            if (node.closing) {
                return;
            }

            node.messageCache.delete(keyMessage);

            let itemQueue = node.virtualQueue.get(keyMessage);

            if (!itemQueue) {
                return;
            }

            clearTimeout(itemQueue.timer);

            if (itemQueue.nodeOut) {
                itemQueue.nodeOut.setOutFree();
            }

            node.virtualQueue.delete(keyMessage);

            node.storage.doneMessage(itemQueue.keyMessage, (err) => {
                if (err) {
                    node.error(err);
                }
                node.processQueue();
            });
        };

        node.registerOut = function registerOut(nodeOut) {

            let id = nodeOut.id;
            let alreadyRegistered = false;

            for(let out of node.listNodeOut) {
                if (id == out.id) {
                    alreadyRegistered = true;
                    break;
                }
            }

            if (!alreadyRegistered){
                node.listNodeOut.push(nodeOut);
            } else {
                node.warn(RED._("safe-queue.message-errors.register-existent"));
            }
            
        };

        //--> Function Storage <--
        node.deleteDone = function deleteDone(days, callback) {
            node.storage.deleteDone(days, callback);
        };

        node.deleteError = function deleteError(days, callback) {
            node.storage.deleteError(days, callback);
        };

        node.resendErrors = function resendErrors(days, callback) {
            node.storage.resendErrors(days, err => {
                if(err) {
                    callback(err);
                    return;
                }

                node.updateMessageList(err => {
                    callback(err);
                    node.processQueue();
                });
            });
        };

        node.getQueueSize = function getQueueSize(callback) {
            node.storage.getQueueSize(callback);
        };

        node.getDoneSize = function getDoneSize(callback) {
            node.storage.getDoneSize(callback);
        };

        node.getErrorSize = function getErrorSize(callback) {
            node.storage.getErrorSize(callback);
        };
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
                text: RED._("safe-queue.status.new-data")
            });

            node.config.receiveMessage(msg, (err) => {
                if (err) {
                    node.error(err);

                    if (values.sendError) {
                        msg.error = err;
                        node.send(msg);
                    }

                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: RED._("safe-queue.status.error")
                    });

                    return;
                }

                node.send(msg);

                node.status({
                    fill: "green",
                    shape: "dot",
                    text: RED._("safe-queue.status.done")
                });
            });
        });
    }

    RED.nodes.registerType("queue in", SafeQueueIn);

    // ------------- SafeQueue Out (queue out) ------------
    function SafeQueueOut(values) {

        var node = this;

        node.outInProcess = false;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.config.registerOut(node);

        node.setOutInProcess = function setOutInProcess() {
            node.outInProcess = true;
            node.status({
                fill: "blue",
                shape: "dot",
                text: RED._("safe-queue.status.process")
            });
        };

        node.setOutFree = function setOutFree() {
            node.outInProcess = false;
            node.status({
                fill: "green",
                shape: "dot",
                text: RED._("safe-queue.status.done")
            });
        };

        node.sendMessage = function sendMessage(message) {
            node.send(message);
        };
    }

    RED.nodes.registerType("queue out", SafeQueueOut);

    // ------------- SafeQueue Control (queue control) ------------
    function SafeQueueControl(values) {

        var node = this;

        node.days = values.days;
        node.operation = values.operation;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        if (!node.config) {
            node.error(RED._("safe-queue.message-errors.error-node-config"));
            return;
        }

        node.on('input', function (msg) {

            switch (node.operation) {
                case 'queue-size':
                    node.config.getQueueSize(function (error, results) {

                        if (!error) {
                            node.status({
                                fill: "blue",
                                shape: "dot",
                                text: results
                            });

                            msg.payload = results;
                            node.send(msg);

                        } else {
                            node.error(error);
                        }
                    });

                    break;

                case 'done-size':
                    node.config.getDoneSize(function (error, results) {

                        if (!error) {
                            node.status({
                                fill: "green",
                                shape: "dot",
                                text: results
                            });

                            msg.payload = results;
                            node.send(msg);

                        } else {
                            node.error(error);
                        }
                    });

                    break;

                case 'error-size':
                    node.config.getErrorSize(function (error, results) {

                        if (!error) {
                            node.status({
                                fill: "red",
                                shape: "dot",
                                text: results
                            });

                            msg.payload = results;
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

                        node.send(msg);
                    });

                    break;

                case 'delete-done':
                    node.config.deleteDone(node.days, (err, results) => {
                        if (err) {
                            node.error(err);
                            return;
                        }

                        node.send(msg);
                    });

                    break;

                case 'resend-errors':
                    node.config.resendErrors(node.days, (err) => {
                        if (err) {
                            node.error(err);
                            return;
                        }
                        node.send(msg);
                    });

                    break;

                case 'start-process':
                    node.config.startProcess();
                    node.send(msg);
                    break;

                case 'stop-process':
                    node.config.stopProcess();
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