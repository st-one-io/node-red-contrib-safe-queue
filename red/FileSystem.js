const fs = require('fs');


class FileSystem {

    constructor(path) {
        this.path = path;
        console.log("Create FileSystem - path: " + this.path);
    }


    addQueue(obj, callback) {
        
        console.log("Chamou");

        var uri = this.path + "queue/" + obj._msgid + ".json";

        fs.writeFile(uri, JSON.stringify(obj.payload), callback);

    }



}

module.exports = FileSystem;