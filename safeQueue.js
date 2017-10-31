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

module.exports = function (RED) {
    "use strict";

    // ------------- SafeQueue In (queue in) ------------
    function SafeQueueIn(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue in", SafeQueueIn);

    // ------------- SafeQueue Out (queue out) ------------
    function SafeQueueOut(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue out", SafeQueueOut);

    // ------------- SafeQueue Control (queue control) ------------
    function SafeQueueControl(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue control", SafeQueueControl);

    // ------------- SafeQueue Config (queue config) ------------
    function SafeQueueConfig(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue config", SafeQueueConfig);

    // ------------- SafeQueue Acknowledge (queue ack) ------------
    function SafeQueueAcknowledge(config) {
        var node = this;

        RED.nodes.createNode(this, config);
    }
    RED.nodes.registerType("queue ack", SafeQueueAcknowledge);

};