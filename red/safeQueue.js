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

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {
        var node = this;

        var storageMode = config.storage;
        var path = config.path;

        if (storageMode == 'fs') {
            this.storage = new FileSystem(path);
        } else {
            if (storageMode == 'bd') {

            }
        }

        RED.nodes.createNode(this, config);

        node.saveMessage = function saveMessage(obj, callback) {
            this.storage.saveMessage(obj, callback);
        }

        node.getMessage = function getMessage(obj, callback) {
            this.storage.getMessage(obj, callback);
        }

        node.getListFiles = function getListFiles(callback) {
            this.storage.getListFiles(callback);
        }

        node.getQueueSize = function getQueueSize() {
            return this.storage.getQueueSize();
        }

        node.getDoneSize = function getDoneSize() {
            return this.storage.getDoneSize();
        }

        node.getErrorSize = function getErrorSize() {
            return this.storage.getErrorSize();
        }

        node.doneMessage = function doneMessage(obj) {
            this.storage.doneMessage(obj);
        }

        node.errorMessage = function errorMessage(obj) {
            this.storage.errorMessage(obj);
        }

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
                    node.status({
                        fill: "green",
                        shape: "dot",
                        text: "done"
                    });
                } else {
                    node.error(err);
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

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.on('input', function (msg) {

            node.config.getListFiles(function (err, files) {

                if (!err) {
                    for (var i = 0; i < files.length; i++) {

                        msg.payload = files[i];

                        node.send(msg);

                    }
                }

            });

        });

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

                var size = node.config.getQueueSize();
                msg.payload = size;

                node.status({
                    fill: "blue",
                    shape: "dot",
                    text: size
                });
            }

            if (operation === 'done-size') {

                var size = node.config.getDoneSize();
                msg.payload = size;

                node.status({
                    fill: "green",
                    shape: "dot",
                    text: size
                });
            }

            if (operation === 'error-size') {

                var size = node.config.getErrorSize();
                msg.payload = size;

                node.status({
                    fill: "red",
                    shape: "dot",
                    text: size
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


            node.send(msg);
        });
    }
    RED.nodes.registerType("queue control", SafeQueueControl);

    // ------------- SafeQueue Acknowledge (queue ack) ------------
    function SafeQueueAcknowledge(values) {

        var node = this;

        RED.nodes.createNode(this, values);

        node.config = RED.nodes.getNode(values.config);

        node.on('input', function (msg) {

            node.config.doneMessage(msg.payload);

        });
    }
    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};