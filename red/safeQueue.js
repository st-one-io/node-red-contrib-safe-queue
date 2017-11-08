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
var inProccess = false;
var messageInProccess = null;
var timer;

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

        node.getNext = function getNext(callback) {
            this.storage.getNext(callback);
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

        node.setProccess = function setProccess(msg){
            messageInProccess = msg;
            inProccess = true;

            timer = setTimeout(node.checkError, 5000);

        }

        node.resetProccess = function resetProccess(){
            messageInProccess = null;
            inProccess = false;

            clearTimeout(timer);
        }

        node.checkError = function checkError(){
            if(inProccess){
                //ocorreu erro
                node.errorMessage(messageInProccess);

                node.resetProccess();

            }
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

            if(!inProccess){

                node.config.getNext(function(err, results){
                    if(!err){
                         
                        if(results != null){
                            node.config.setProccess(results);
                            msg.payload = results;
                            node.send(msg);
                        }

                    }else{
                        console.log("Error: " + err);
                    }
                });
            }
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

                node.config.getQueueSize(function (error, results) {

                    if (!error) {
                        var size = results;

                        node.status({
                            fill: "blue",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                    }else{
                        node.error(error);
                    }
                });
            }

            if (operation === 'done-size') {

                node.config.getDoneSize(function(error, results){
                    
                    if (!error) {
                        
                        var size = results;
                        node.status({
                            fill: "green",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                    }else{
                        node.error(error);
                    }
                });
            }

            if (operation === 'error-size') {

                node.config.getErrorSize(function(error, results){
                    
                    if (!error) {
                        
                        var size = results;
                        node.status({
                            fill: "red",
                            shape: "dot",
                            text: size
                        });

                        msg.payload = size;
                    }else{
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

            node.config.doneMessage(msg.payload, function(err, results){
                if(!err){
                    node.config.resetProccess();
                }else{
                    console.log("--Error: " + err);
                }
            });

        });
    }
    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};