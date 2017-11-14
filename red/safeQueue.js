/*
   Copyright 2016-2017 Smart-Tech Controle e Automação

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

const FileSystem = require('./FileSystem.js');
const fs = require('fs');
const pathLib = require('path');
const os = require('os');

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {
        var node = this;

        this.name = config.name;

        this.inProccess = new Map();

        this.listNodeOut = [];

        this.virtualQueue = new Map();

        this.controlInit = false;

        this.homeDir = os.homedir();

        this.timeOut = config.timeoutAck;

        if (this.timeOut.length == 0) {
            this.timeOut = 1000;
        }


        this.path = config.path;

        if (this.path.length == 0) {
            this.path = pathLib.join(this.homeDir, this.name);
        }


        this.storageMode = config.storage;

        if (this.storageMode == 'fs') {
            this.storage = new FileSystem(this.path);
        }

        
        RED.nodes.createNode(this, config);

        this.storage.on('newFile', () => {
            node.proccessQueue();
        });


        node.init = function init() {
            this.storage.getListFiles(function (err, files) {
                if (!err) {
                    for (var file of files) {
                        node.addVirtualQueue(file);
                    }
                }
            });
        }

        node.getVirtualQueue = function getVirtualQueue() {
            return this.virtualQueue;
        }

        node.saveMessage = function saveMessage(obj, callback) {
            this.storage.saveMessage(obj, callback);
        }

        node.getMessage = function getMessage(obj, callback) {
            this.storage.getMessage(obj, callback);
        }

        node.getListFiles = function getListFiles(callback) {
            this.storage.getListFiles(callback);
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

        node.doneMessage = function doneMessage(obj, callback) {
            this.storage.doneMessage(obj, callback);
        }

        node.errorMessage = function errorMessage(obj, callback) {
            this.storage.errorMessage(obj, callback);
        }

        //-------------

        node.setProccess = function setProccess(keyMessage) {
            var item = {};

            const timer = setTimeout(node.checkError, this.timeOut);

            item.timer = timer;
            item.keyMessage = keyMessage;
            item.inProccess = true;

            this.inProccess.set(keyMessage, item);
        }

        node.resetProccess = function resetProccess(keyMessage) {
            var item = this.inProccess.get(keyMessage);
            clearTimeout(item.timer);
        }

        node.getListInProccess = function getListInProccess() {
            return this.inProccess;
        }

        node.checkError = function checkError() {

            var idTimer = this._idleStart;

            var listProccess = node.getListInProccess();

            for (var value of listProccess.values()) {

                if (value.timer._idleStart == idTimer) {

                    node.warn('Fail sending: ' + value.keyMessage);

                    node.resetProccess(value.keyMessage);
                    node.removeVirtualQueue(value.keyMessage);

                    node.errorMessage(value.keyMessage, function (err, results) {

                        if (err) {
                            node.error("Fail move the file for dir Error", err);
                        }
                    });

                    return;

                }
            }

        }

        node.getInit = function getInit() {
            return this.controlInit;
        }

        node.setInit = function setInit(value) {
            this.controlInit = value;
        }

        node.registerOut = function registerOut(nodeOut) {
            this.listNodeOut.push(nodeOut);

            if (!node.getInit()) {
                node.init();
                node.setInit(true);
            }


            console.log("-->Nodes OUT:", this.listNodeOut.length);
        }

        node.addVirtualQueue = function addVirtualQueue(keyMessage) {

            let object = {};

            object.keyMessage = keyMessage;
            object.proccess = false;
            object.nodeOut = null;
            object.timer = null;

            this.virtualQueue.set(keyMessage, object);
        }

        node.removeVirtualQueue = function removeVirtualQueue(keyMessage) {

            var map = this.virtualQueue.get(keyMessage);

            var out = RED.nodes.getNode(map.nodeOut);

            out.resetOutInProccess();

            this.virtualQueue.delete(keyMessage);

            this.inProccess.delete(keyMessage);

            node.proccessQueue();
        }

        node.getMessageProccess = function getMessageProccess() {
            var mapMessage = this.virtualQueue;

            for (var key of mapMessage.keys()) {
                var message = {};
                message = mapMessage.get(key);
                message.key = key;

                if (!message.proccess) {
                    return message;
                }
            }
            return null;
        }

        node.getNodeOut = function getNodeOut() {

            var listNodes = this.listNodeOut;

            for (var x = 0; x < listNodes.length; x++) {
                if (!listNodes[x].getOutInProccess()) {
                    return listNodes[x].id;
                }
            }

            return null;
        }

        node.getOutNodeRegisters = function getOutNodeRegisters() {

            var listNodes = this.listNodeOut;
            return listNodes.length;

        }

        node.proccessQueue = function proccessQueue() {

            var idNodeOut = node.getNodeOut();

            if (idNodeOut != null) {

                var message = node.getMessageProccess();

                if (message != null) {

                    var nodeOut = RED.nodes.getNode(idNodeOut);

                    nodeOut.setOutInProccess();

                    message.proccess = true;
                    message.nodeOut = idNodeOut;

                    this.virtualQueue.set(message.key, message);

                    nodeOut.sendMessage(message.key);
                }
            }
        }



        //--> Métodos desatualizados 
        node.deleteDone = function deleteDone() {
            return this.storage.deleteDone();
        }

        node.deleteError = function deleteError() {
            return this.storage.deleteError();
        }

        node.deleteQueue = function deleteQueue() {
            return this.storage.deleteQueue();
        }

        node.resendErrors = function resendErrors() {
            return this.storage.resendErrors();
        }
        //--> Métodos desatualizados 

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

            node.config.saveMessage(msg, function (err) {

                if (!err) {
                    node.send(msg);

                    node.config.addVirtualQueue(msg._msgid);
                    node.config.proccessQueue();

                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "done"
                    });
                } else {

                    //node.error("Fail dir queue - do new deploy or restart your application");
                    msg.error = err;
                    node.send(msg);

                    node.status({
                        fill: "red",
                        shape: "dot",
                        text: "error"
                    });
                }
            });
        });
    }
    RED.nodes.registerType("queue in", SafeQueueIn);

    // ------------- SafeQueue Out (queue out) ------------
    function SafeQueueOut(values) {

        var node = this;

        this.outInProccess = false;
        this.timer = null;
        this.keyMessage = null;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.config.registerOut(node);


        node.setOutInProccess = function setOutInProccess() {
            this.outInProccess = true;

            node.status({
                fill: "red",
                shape: "dot",
                text: "proccess"
            });
        }

        node.resetOutInProccess = function resetOutInProccess() {
            this.outInProccess = false;

            node.status({
                fill: "green",
                shape: "dot",
                text: "free"
            });
        }

        node.getOutInProccess = function getOutInProccess() {
            return this.outInProccess;
        }


        node.sendMessage = function sendMessage(keyMessage) {
            var msg = {};
            this.keyMessage = keyMessage;

            node.config.getMessage(keyMessage, function (err, results) {

                if (!err) {
                    msg.id = keyMessage;
                    msg.payload = results;
                    node.send(msg);
                    node.config.setProccess(keyMessage);
                }


            });
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

            if (operation === 'delete-queue') {
                msg.payload = node.config.deleteQueue();
            }

            if (operation === 'delete-error') {
                msg.payload = node.config.deleteError();
            }

            if (operation === 'delete-done') {
                msg.payload = node.config.deleteDone();
            }

            if (operation === 'resend-errors') {
                msg.payload = node.config.resendErrors();
            }

            if (operation === 'start-proccess') {
                for (var x = 0; x < node.config.getOutNodeRegisters(); x++) {
                    node.config.proccessQueue();
                }
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

            node.config.doneMessage(msg.id, function (err, results) {
                if (!err) {
                    node.config.resetProccess(msg.id);
                    node.config.removeVirtualQueue(msg.id);
                } else {
                    node.error("Fail move the file for dir Done", err);
                }
            });

        });
    }
    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};