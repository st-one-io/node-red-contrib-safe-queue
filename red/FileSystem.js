const fs = require('fs');
const pathLib = require('path');

class FileSystem {

    constructor(path) {
        this.path = path;

        var urlBase = this.path;
        var uriQueue = this.path + "/queue";
        var uriDone = this.path + "/done";
        var uriError = this.path + "/error";

        if (!fs.existsSync(urlBase)) {
            fs.mkdir(urlBase, function (err) {
                if (!err) {
                    console.log("create repository: " + urlBase);
                } else {
                    console.log("failure repository: " + urlBase + "\n Error: " + err);
                }
            });
        }

        if (!fs.existsSync(uriQueue)) {
            fs.mkdir(uriQueue, function (err) {
                if (!err) {
                    console.log("create repository: " + uriQueue);
                } else {
                    console.log("failure repository: " + uriQueue + "\n Error: " + err);
                }
            });
        }

        if (!fs.existsSync(uriDone)) {
            fs.mkdir(uriDone, function (err) {
                if (!err) {
                    console.log("create repository: " + uriDone);
                } else {
                    console.log("failure repository: " + uriDone + "\n Error: " + err);
                }
            });
        }

        if (!fs.existsSync(uriError)) {
            fs.mkdir(uriError, function (err) {
                if (!err) {
                    console.log("create repository: " + uriError);
                } else {
                    console.log("failure repository: " + uriError + "\n Error: " + err);
                }
            });
        }

        console.log("FileSystem - path: " + this.path);
    }


    saveMessage(obj, callback) {
        const uri = this.path + "/queue/" + obj._msgid + ".json";
        fs.writeFile(uri, JSON.stringify(obj.payload), callback);
    }

    getMessage(obj, callback) {
        const uri = this.path + "/queue/" + obj;
        fs.readFile(uri, 'utf8', callback);
    }

    getListFiles(callback) {
        fs.readdir(this.path + "/queue/", 'utf8', callback);
    }

    getQueueSize() {
        var cont = fs.readdirSync(this.path + "/queue/", 'utf8').length;
        return cont;
    }

    getDoneSize() {
        var cont = 0;

        var url = this.path + "/done/";

        var dirs = fs.readdirSync(url, 'utf8');

        for (var i = 0; i < dirs.length; i++) {

            var newUrl = url + dirs[i] + "/";

            var files = fs.readdirSync(newUrl, 'utf8');

            cont = cont + files.length;
        }

        return cont;
    }

    getErrorSize() {

        var cont = 0;

        var url = this.path + "/error/";

        var dirs = fs.readdirSync(url, 'utf8');

        for (var i = 0; i < dirs.length; i++) {

            var newUrl = url + dirs[i] + "/";

            var files = fs.readdirSync(newUrl, 'utf8');

            cont = cont + files.length;
        }

        return cont;
    }

    doneMessage(obj) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = this.path + "/queue/" + obj;
        const baseNewUri = this.path + "/done/" + year + "-" + month + "-" + day + "/";
        const newUri = baseNewUri + obj;

        if (!fs.existsSync(baseNewUri)) {
            fs.mkdir(baseNewUri, function (err) {
                if (!err) {
                    console.log("create repository");
                } else {
                    console.log("-->mkdir_error: " + err);
                }
            });
        }

        fs.renameSync(uri, newUri);

    }

    errorMessage(obj, callback) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = this.path + "/queue/" + obj;
        const baseNewUri = this.path + "/error/" + year + "-" + month + "-" + day + "/";
        const newUri = baseNewUri + obj;

        if (!fs.existsSync(baseNewUri)) {
            fs.mkdir(baseNewUri, function (err) {
                if (!err) {
                    console.log("create repository");
                } else {
                    console.log("-->mkdir_error: " + err);
                }
            });
        }

        fs.rename(uri, newUri, callback);

    }

    resendErrors() {

        var url = this.path + "/error/";

        var dirs = fs.readdirSync(url, 'utf8');

        for (var i = 0; i < dirs.length; i++) {

            var newUrl = url + dirs[i] + "/";

            var files = fs.readdirSync(newUrl, 'utf8');

            for (var x = 0; x < files.length; x++) {
                fs.renameSync(newUrl + files[x], this.path + "/queue/" + files[x]);
            }

            fs.rmdirSync(url + dirs[i]);
        }

        dirs = fs.readdirSync(url, 'utf8');

        if (dirs == 0) {
            return true;
        } else {
            return false;
        }

    }

    deleteDone() {

        var url = this.path + "/done/";

        var dirs = fs.readdirSync(url, 'utf8');

        for (var i = 0; i < dirs.length; i++) {

            var newUrl = url + dirs[i] + "/";

            var files = fs.readdirSync(newUrl, 'utf8');

            for (var x = 0; x < files.length; x++) {
                fs.unlinkSync(newUrl + files[x]);
            }

            fs.rmdirSync(url + dirs[i]);
        }

        dirs = fs.readdirSync(url, 'utf8');

        if (dirs == 0) {
            return true;
        } else {
            return false;
        }

    }

    deleteError() {

        var url = this.path + "/error/";

        var dirs = fs.readdirSync(url, 'utf8');

        for (var i = 0; i < dirs.length; i++) {

            var newUrl = url + dirs[i] + "/";

            var files = fs.readdirSync(newUrl, 'utf8');

            for (var x = 0; x < files.length; x++) {
                fs.unlinkSync(newUrl + files[x]);
            }

            fs.rmdirSync(url + dirs[i]);
        }

        dirs = fs.readdirSync(url, 'utf8');

        if (dirs == 0) {
            return true;
        } else {
            return false;
        }

    }

    deleteQueue() {

        var url = this.path + "/queue/";

        var files = fs.readdirSync(url, 'utf8');

        for (var x = 0; x < files.length; x++) {
            fs.unlinkSync(url + files[x]);
        }

        files = fs.readdirSync(url, 'utf8');

        if (files == 0) {
            return true;
        } else {
            return false;
        }

    }

}

module.exports = FileSystem;