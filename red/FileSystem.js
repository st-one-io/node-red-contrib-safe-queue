const fs = require('fs');
const os = require('os');
const pathLib = require('path');
const EventEmitter = require('events');
const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";
const extension = ".json";


class FileSystem extends EventEmitter {

    constructor(obj) {
        super();

        this.path = obj.path;

        let queueName = obj.queueName;
        let homeDir = os.homedir();

        if (this.path.length == 0) {
            this.path = pathLib.join(homeDir, queueName);
        }

        var fileSystem = this;

        this.uriBase = pathLib.join(this.path);
        this.uriQueue = pathLib.join(this.path, queueFolder);
        this.uriDone = pathLib.join(this.path, doneFolder);
        this.uriError = pathLib.join(this.path, errorFolder);
    }

    init(callback) {

        var fileSystem = this;

        fs.stat(fileSystem.uriBase, (err) => {
            if (err) {
                //console.log("Construtor  -> New UrlBase");
                fs.mkdir(fileSystem.uriBase, function (err) {
                    //console.log("Construtor  -> Dir UrlBase - ERR: ", err);
                    if (!err) {
                        fs.mkdir(fileSystem.uriQueue, function (err) {
                            //console.log("Construtor  -> Dir UrlQueue - ERR: ", err);
                            if (!err) {
                                fs.mkdir(fileSystem.uriDone, function (err) {
                                    //console.log("Construtor  -> Dir UrlDone - ERR: ", err);
                                    if (!err) {
                                        fs.mkdir(fileSystem.uriError, function (err) {
                                            //console.log("Construtor  -> Dir UrlError - ERR: ", err);
                                            if (!err) {
                                                //console.log("chamou");
                                                fileSystem.createWatch();
                                                callback(err);
                                            } else {
                                                console.log("failure repository: " + fileSystem.uriError + "\n Error: " + err);
                                                callback(err);
                                            }
                                        });
                                    } else {
                                        console.log("failure repository: " + fileSystem.uriDone + "\n Error: " + err);
                                        callback(err);
                                    }
                                });
                            } else {
                                console.log("failure repository: " + fileSystem.uriQueue + "\n Error: " + err);
                                callback(err);
                            }
                        });
                    } else {
                        console.log("failure repository: " + fileSystem.uriBase + "\n Error: " + err);
                        callback(err);
                    }
                });
            } else {
                fs.stat(fileSystem.uriQueue, (err, stats) => {
                    if (err) {
                        fs.mkdir(fileSystem.uriQueue, (err) => {
                            if (!err) {
                                fileSystem.createWatch();
                                callback(err);
                            }
                        });
                    } else {
                        if (stats.isDirectory()) {
                            fileSystem.createWatch();
                            callback(err);
                        }
                    }
                });

            }
        });

    }

    createWatch() {

        //console.log("Create Watch");

        this.watch = true;

        var uriQueue = pathLib.join(this.path, queueFolder);

        var fileSystem = this;

        this.watcher = fs.watch(uriQueue, (eventType, fileName) => this.onChange(eventType, fileName));

        this.watcher.on('error', function (e) {
            //console.log("Watch Error");
            fileSystem.close();
            //fileSystem.createDirQueue();
        });
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

    //--> Verificar diretorio


    //--> Verificar diretorio

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

        const uriBase = pathLib.join(this.path);
        const uriQueue = pathLib.join(this.path, queueFolder);
        const uriFile = pathLib.join(this.path, queueFolder, obj._msgid + extension);

        var fileSystem = this;

        var error = null;
        var results = null;

        fs.stat(uriBase, (err, stats) => {
            if (!err) {
                fs.stat(uriQueue, (err, stats) => {
                    if (!err) {
                        //Grava file
                        gravaFile();
                    } else {
                        //Create file queue
                        fs.mkdir(uriQueue, (err) => {
                            if (!err) {
                                //Habilita watch
                                //Grava File
                                fileSystem.createWatch();
                                gravaFile();
                            } else {
                                callback(err, false);
                            }
                        });

                    }
                });
            } else {
                //Create Base
                fileSystem.close();
                fileSystem.init((err) => {
                    if (!err) {
                        //grava file
                        gravaFile();
                    } else {
                        callback(err, false);
                    }
                });
            }
        });

        function gravaFile() {
            fs.writeFile(uriFile, obj.payload, (err) => {
                error = err;

                if (!err) {
                    callback(error, true);
                } else {
                    callback(error, false);
                }
            });
        }

    }

    doneMessage(obj, callback) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = pathLib.join(this.path, queueFolder, obj + extension);
        const baseNewUri = pathLib.join(this.path, doneFolder, year + "-" + month + "-" + day);
        const newUri = pathLib.join(baseNewUri, obj + extension);

        const uriBase = pathLib.join(this.path);
        const uriDone = pathLib.join(uriBase, doneFolder);

        var error = null;
        var results = null;

        fs.stat(uriBase, (err, stats) => {
            if (!err) {
                fs.stat(uriDone, (err, stats) => {
                    if (!err) {
                        //moveDone
                        moveDone();
                    } else {
                        //Create dir done
                        fs.mkdir(uriDone, (err) => {
                            if (!err) {
                                //moveDone
                                moveDone();
                            } else {
                                callback(err, false);
                            }
                        });
                    }
                });
            } else {
                //Create Base
                fileSystem.close();
                fileSystem.init((err) => {
                    if (!err) {
                        //moveDone
                        moveDone();
                    } else {
                        callback(err, false);
                    }
                });
            }
        });

        function moveDone() {
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
    }

    errorMessage(keyMessage, callback) {

        var date = new Date(Date.now());

        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uriBase = pathLib.join(this.path);
        const uriError = pathLib.join(uriBase, errorFolder);
        const uri = pathLib.join(uriBase, queueFolder, keyMessage + extension);
        const baseNewUri = pathLib.join(uriError, year + "-" + month + "-" + day);
        const newUriFile = pathLib.join(baseNewUri, keyMessage + extension);

        var error = null;
        var results = null;

        fs.stat(uriBase, (err, stats) => {
            if (!err) {
                fs.stat(uriError, (err, stats) => {
                    if (!err) {
                        //moveError
                        moveError();
                    } else {
                        //Create dir error
                        fs.mkdir(uriError, (err) => {
                            if (!err) {
                                //moveError
                                moveError();
                            } else {
                                callback(err, false);
                            }
                        });

                    }
                });
            } else {
                //Create Base
                fileSystem.close();
                fileSystem.init((err) => {
                    if (!err) {
                        //moveError
                        moveError();
                    } else {
                        callback(err, false);
                    }
                });
            }
        });

        function moveError() {
            fs.stat(baseNewUri, function (err, stats) {

                error = err;

                if (!err) {
                    if (stats.isDirectory()) {
                        fs.rename(uri, newUriFile, function (err) {

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

                            fs.rename(uri, newUriFile, function (err) {
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

    }

    //--> CONTROL FILES

    //--> GET FILES
    getMessage(keyFile, callback) {
        const uri = pathLib.join(this.path, queueFolder, keyFile + extension);

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
        var listFiles = [];


        fs.readdir(uri, 'utf8', function (err, files) {

            error = err;

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

        fs.stat(url, (err, stats) => {
            if (!err) {
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
            } else {
                callback(err, true);
            }
        });


    }

    deleteError(callback) {

        var url = pathLib.join(this.path, errorFolder);

        var dirs = null;
        var error = null;

        fs.stat(url, (err, stats) => {
            if (!err) {
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
            } else {
                callback(err, true);
            }
        });


    }

    //--> DELETE FILES
}

module.exports = FileSystem;