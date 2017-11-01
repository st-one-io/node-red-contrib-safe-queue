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
        this.storage = new FileSystem("/home/smarttech/Desktop/SafeQueue/");
        var addInProgress = false;
        var addProgressOk = false;
        var addFail = 0;
        var newMessage = false;
        var message = null;

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

        node.getQueueSize = function getQueueSize(){
            return this.storage.getQueueSize();    
        }

        node.deleteMessage = function deleteMessage(obj){
            this.storage.deleteMessage(obj);
        }

        function defineStorage() {
            this.storage = new FileSystem("/home/smarttech/Desktop/SafeQueue/");
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
                    node.log("save ok");
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

            node.config.getListFiles(function (err, files){
                if(!err){
                    for(var i = 0; i < files.length; i++){
                        
                        node.config.getMessage(files[i], function(err, data){
                            console.log(JSON.stringify(data));
                        });

                        node.config.deleteMessage(files[i]);
                    }
                }
            });

            var teste = node.config.getQueueSize();
            console.log("---> getQueueSize: " + teste);



            node.send(msg);
        });

    }
    RED.nodes.registerType("queue out", SafeQueueOut);

    // ------------- SafeQueue Control (queue control) ------------
    function SafeQueueControl(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue control", SafeQueueControl);

    // ------------- SafeQueue Acknowledge (queue ack) ------------
    function SafeQueueAcknowledge(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};