const fs = require('fs');
const pathLib = require('path');
const EventEmitter = require('events');
const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";
const extension = ".json";

class FileSystem extends EventEmitter {

    constructor(path) {
        super();
        this.path = path;

        var fileSystem = this;

        var urlBase = pathLib.join(this.path);
        var uriQueue = pathLib.join(this.path, queueFolder);
        var uriDone = pathLib.join(this.path, doneFolder);
        var uriError = pathLib.join(this.path, errorFolder);



        if (!fs.existsSync(urlBase)) {
            fs.mkdir(urlBase, function (err) {
                if (!err) {
                    fs.mkdir(uriQueue, function (err) {
                        if (!err) {
                            fs.mkdir(uriDone, function (err) {
                                if (!err) {
                                    fs.mkdir(uriError, function (err) {
                                        if (!err) {
                                            fileSystem.createWatch();
                                        } else {
                                            console.log("failure repository: " + uriError + "\n Error: " + err);
                                        }
                                    });
                                } else {
                                    console.log("failure repository: " + uriDone + "\n Error: " + err);
                                }
                            });
                        } else {
                            console.log("failure repository: " + uriQueue + "\n Error: " + err);
                        }
                    });
                } else {
                    console.log("failure repository: " + urlBase + "\n Error: " + err);
                }
            });
        }
    }

    createWatch() {

        // console.log("Create Watch");

        var uriQueue = pathLib.join(this.path, queueFolder);

        var fileSystem = this;

        this.watcher = fs.watch(uriQueue, (eventType, fileName) => this.onChange(eventType, fileName));

        this.watcher.on('error', function (e) {
            // console.log("Watch Error");
            this.watcher.close();
            fileSystem.createDirQueue();
        });
    }

    createDirQueue() {

        //console.log("Create Dir Queue");

        var uriQueue = pathLib.join(this.path, queueFolder);

        do {} while (fs.existsSync(uriQueue));

        fs.mkdirSync(uriQueue);

        var stats = fs.statSync(uriQueue);

        if (stats.isDirectory()) {
            console.log("success to create directory: " + uriQueue);
        } else {
            console.log("error to create directory: " + uriQueue + "\n Error: " + err);
        }

        this.createWatch();

    }

    close() {
        //console.log("Close Watch");
        this.watcher.close();
    }

    onChange(eventType, fileName) {
        if (eventType == 'change') {
            this.emit('newFile');
        }
    }

    //--> GET SIZES
    getQueueSize(callback) {
        const uri = pathLib.join(this.path, queueFolder);

        var cont = 0;
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
                if (dirs.length > 0) {
                    for (let x = 0; x < dirs.length; x++) {

                        var newUrl = pathLib.join(url, dirs[x]);

                        fs.readdir(newUrl, 'utf8', function (err, files) {

                            error = err;

                            if (!err) {
                                cont = cont + files.length;
                                turn++;
                                if (turn == dirs.length) {
                                    callback(error, cont);
                                }

                            } else {
                                callback(error, cont);
                            }
                        });
                    }
                } else {
                    callback(error, cont);
                }
            } else {
                callback(error, cont);
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

                if (dirs.length > 0) {
                    for (let x = 0; x < dirs.length; x++) {

                        var newUrl = pathLib.join(url, dirs[x]);

                        fs.readdir(newUrl, 'utf8', function (err, files) {

                            if (!err) {
                                cont = cont + files.length;
                                turn++;
                                if (turn == dirs.length) {
                                    callback(error, cont);
                                }

                            } else {
                                callback(error, cont);
                            }
                        });
                    }
                } else {
                    callback(error, cont);
                }
            } else {
                callback(error, cont);
            }
        });
    }
    //--> GET SIZES    


    //--> CONTROL FILES
    saveMessage(obj, callback) {

        const uriBase = pathLib.join(this.path, queueFolder);
        const uriQueue = pathLib.join(this.path, queueFolder, obj._msgid + extension);

        var fileSystem = this;

        var error = null;
        var results = null;

        fs.stat(uriBase, function (err, stats) {

            error = err;

            if (!err) {
                fs.writeFile(uriQueue, obj.payload, function (err) {

                    error = err;

                    if (!err) {
                        results = true;
                    }

                    callback(error, results);

                });
            } else {

                fileSystem.createDirQueue();

                callback(error, results);
            }
        });
    }

    doneMessage(obj, callback) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = pathLib.join(this.path, queueFolder, obj + extension);
        const baseNewUri = pathLib.join(this.path, doneFolder, year + "-" + month + "-" + day);
        const newUri = pathLib.join(baseNewUri, obj + extension);

        var error = null;
        var results = null;

        fs.stat(baseNewUri, function (err, stats) {

            error = err;

            if (!err) {
                if (stats.isDirectory()) {
                    fs.rename(uri, newUri, function (err) {

                        error = err;

                        if (!err) {
                            results = true;
                            callback(error, results);
                        } else {
                            results = false;
                            callback(error, results);
                        }
                    });

                }
            } else {

                fs.mkdir(baseNewUri, function (err) {
                    error = err;

                    if (!err) {

                        // console.log("\n --> doneMessage - Create repository: " + baseNewUri);

                        fs.rename(uri, newUri, function (err) {
                            error = err;

                            if (!err) {
                                results = true;
                                callback(error, results);
                            } else {
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

        const uri = pathLib.join(this.path, queueFolder, obj + extension);
        const baseNewUri = pathLib.join(this.path, errorFolder, year + "-" + month + "-" + day);
        const newUri = pathLib.join(baseNewUri, obj + extension);

        var error = null;
        var results = null;

        fs.stat(baseNewUri, function (err, stats) {

            error = err;

            if (!err) {
                if (stats.isDirectory()) {
                    fs.rename(uri, newUri, function (err) {

                        error = err;

                        if (!err) {
                            results = true;
                            callback(error, results);
                        } else {
                            results = false;
                            callback(error, results);
                        }
                    });

                }
            } else {

                fs.mkdir(baseNewUri, function (err) {
                    error = err;

                    if (!err) {

                        // console.log("\n --> errorMessage - Create repository: " + baseNewUri);

                        fs.rename(uri, newUri, function (err) {
                            error = err;

                            if (!err) {
                                results = true;
                                callback(error, results);
                            } else {
                                results = false;
                                callback(error, results);
                            }
                        });
                    }
                });

            }
        });

    }
    //--> CONTROL FILES

    //--> GET FILES
    getMessage(obj, callback) {
        const uri = pathLib.join(this.path, queueFolder, obj + extension);

        var error = null;
        var results = {};

        fs.readFile(uri, 'utf8', function (err, data) {

            error = err;

            if (!err) {
                results = data;
            }

            callback(error, results);

        });
    }

    getListFiles(callback) {
        const uri = pathLib.join(this.path, queueFolder);

        var error = null;


        fs.readdir(uri, 'utf8', function (err, files) {

            error = err;
            var listFiles = [];

            if (!err) {
                for (var file of files) {

                    const uriFile = pathLib.join(uri, file);
                    var baseName = pathLib.basename(uriFile, extension);


                    listFiles.push(baseName);
                }
            }
            callback(error, listFiles);
        });
    }

    resendErrors(callback) {

        var error = null;

        var urlError = pathLib.join(this.path, errorFolder);

        var urlQueue = pathLib.join(this.path, queueFolder);

        fs.readdir(urlError, 'utf8', function (err, dirs) {

            error = err;

            if (!err) {
                for (var i = 0; i < dirs.length; i++) {

                    var urlDir = pathLib.join(urlError, dirs[i]);

                    var files = fs.readdirSync(urlDir, 'utf8');

                    for (var x = 0; x < files.length; x++) {

                        var urlFile = pathLib.join(urlDir, files[x]);
                        var urlNext = pathLib.join(urlQueue, files[x]);

                        fs.renameSync(urlFile, urlNext);
                    }

                    fs.rmdirSync(urlDir);
                }

                callback(error, true);
            } else {
                callback(error, false);
            }
        });
    }
    //--> GET FILES

    //--> DELETE FILES
    deleteQueue(callback) {

        var url = pathLib.join(this.path, queueFolder);

        var error = null;
        var results = null;

        fs.readdir(url, 'utf8', function (err, files) {

            error = err;

            if (!err) {

                for (var file of files) {
                    var urlFile = pathLib.join(url, file);
                    fs.unlinkSync(urlFile);
                }

                callback(error, true);
            } else {
                callback(error, false);
            }
        });
    }

    deleteDone(callback) {

        var url = pathLib.join(this.path, doneFolder);

        var dirs = null;
        var error = null;

        fs.readdir(url, 'utf8', function (err, dirs) {

            error = err;

            if (!err) {

                for (var i = 0; i < dirs.length; i++) {

                    var urlDir = pathLib.join(url, dirs[i]);

                    var files = fs.readdirSync(urlDir, 'utf8');

                    for (var x = 0; x < files.length; x++) {
                        var urlFiles = pathLib.join(urlDir, files[x]);
                        fs.unlinkSync(urlFiles);
                    }

                    fs.rmdirSync(urlDir);
                }
                callback(error, true);
            } else {
                callback(error, false);
            }
        });
    }

    deleteError(callback) {

        var url = pathLib.join(this.path, errorFolder);

        var dirs = null;
        var error = null;

        fs.readdir(url, 'utf8', function (err, dirs) {

            error = err;

            if (!err) {

                for (var i = 0; i < dirs.length; i++) {

                    var urlDir = pathLib.join(url, dirs[i]);

                    var files = fs.readdirSync(urlDir, 'utf8');

                    for (var x = 0; x < files.length; x++) {
                        var urlFiles = pathLib.join(urlDir, files[x]);
                        fs.unlinkSync(urlFiles);
                    }

                    fs.rmdirSync(urlDir);
                }
                callback(error, true);
            } else {
                callback(error, false);
            }
        });
    }
    //--> DELETE FILES
}

module.exports = FileSystem;