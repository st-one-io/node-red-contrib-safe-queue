const fs = require('fs');
const pathLib = require('path');
const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";


class FileSystem {

    constructor(path) {
        this.path = path;

        var urlBase  = pathLib.join(this.path);
        var uriQueue = pathLib.join(this.path, queueFolder);
        var uriDone  = pathLib.join(this.path, doneFolder);
        var uriError = pathLib.join(this.path, errorFolder);

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
        const uri = pathLib.join(this.path, queueFolder, obj._msgid + ".json");
        fs.writeFile(uri, JSON.stringify(obj.payload), callback);
    }

    getMessage(obj, callback) {
        const uri = this.path + queueFolder + obj;
        fs.readFile(uri, 'utf8', callback);
    }

    getListFiles(callback) {
        const uri = pathLib.join(this.path, queueFolder);
        fs.readdir(uri , 'utf8', callback);
    }

    
    getNext(callback) {

        var error = null;
        var results = null;

        const uri = pathLib.join(this.path, queueFolder);
        fs.readdir(uri , 'utf8', function(err, files){
            error = err;
           if(!err){

                console.log("Files: " + files[0]);

               if(typeof files[0] !== 'undefined'){
                   results = files[0];
               }else{
                   results = null;
               }
                
                callback(error, results);
            }else{
                results = null;
                callback(error, results);
            }
        });
    }

    getQueueSize(callback) {
        const uri = pathLib.join(this.path, queueFolder);

        var cont = null;
        var error = null;
        
        fs.readdir(uri, 'utf8', function (err, files) {

            if (!err) {
                cont = files.length;
            } else {
                console.log(err);
            }

            error = err;
            callback(error, cont);

        });
    }

    getDoneSize(callback) {
        const url = pathLib.join(this.path, doneFolder);
        
        var cont = 0;
        var error = null;
        var turn = 0;
        
        fs.readdir(url, 'utf8', function (err, dirs) {

            if (!err) {

                for (let x = 0; x < dirs.length; x++) {

                    var newUrl = pathLib.join(url, dirs[x]);

                    fs.readdir(newUrl, 'utf8', function (err, files) {

                        if (!err) {
                            cont = cont + files.length;
                            turn++;
                            if(turn == dirs.length){
                                callback(error, cont);
                            }  
                            
                        } else {
                            console.log(err);
                        }
                    });
                }
            }
        });


    }

    getErrorSize(callback) {
        const url = pathLib.join(this.path, errorFolder);

        var cont = 0;
        var error = null;
        var turn = 0;
        
        fs.readdir(url, 'utf8', function (err, dirs) {

            if (!err) {

                for (let x = 0; x < dirs.length; x++) {

                    var newUrl = pathLib.join(url, dirs[x]);

                    fs.readdir(newUrl, 'utf8', function (err, files) {

                        if (!err) {
                            cont = cont + files.length;
                            turn++;
                            if(turn == dirs.length){
                                callback(error, cont);
                            }  
                            
                        } else {
                            console.log(err);
                        }
                    });
                }
            }
        });
    }

    doneMessage(obj, callback) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = pathLib.join(this.path, queueFolder, obj);
        const baseNewUri = pathLib.join(this.path, doneFolder,  year + "-" + month + "-" + day );
        const newUri = pathLib.join(baseNewUri, obj);

        var error = null;
        var results = null;

        fs.stat(baseNewUri, function(err, stats){
            
            error = err;

            if(!err){
                if(!stats.isDirectory()){

                    fs.mkdir(baseNewUri, function (err) {
                        error = err;

                        if (!err) {
                            
                            console.log("create repository: " + baseNewUri);

                            fs.rename(uri, newUri, function(err){
                                error = err;
                                
                                if(!err){
                                    results = true;
                                    callback(error, results);
                                }else{
                                    results = false;
                                    callback(error, results);
                                }
                            });
                        } 
                    });

                }else{
                    
                    fs.rename(uri, newUri, function(err){
                        
                        error = err;

                        if(!err){
                            results = true;
                            callback(error, results);
                        }else{
                            results = false;
                            callback(error, results);
                        }
                    });
                }
            }else{
                
                fs.mkdir(baseNewUri, function (err) {
                    error = err;

                    if (!err) {
                        
                        console.log("create repository: " + baseNewUri);

                        fs.rename(uri, newUri, function(err){
                            error = err;
                            
                            if(!err){
                                results = true;
                                callback(error, results);
                            }else{
                                results = false;
                                callback(error, results);
                            }
                        });
                    } 
                });

            }
        });


        

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