'use strict';

const fs = require('fs');
const os = require('os');
const pathLib = require('path');
const EventEmitter = require('events');
const mkdirp = require('mkdir-p');

const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";
const extension = ".json";

function countFiles(arr) {
    var count = 0;
    arr.forEach(f => {
        if (f.endsWith(extension)) count++;
    });
    return count;
}

function getFolderSize(path, chkSubdir, callback) {

    var dirsCount, count = 0;

    fs.readdir(path, 'utf8', (err, arr) => {

        if (err) {
            callback(err);
            return;
        }

        if (chkSubdir) {
            dirsCount = arr.length;

            if(dirsCount === 0){
                callback(null, 0);
                return;
            }

            arr.forEach(dir => {
                var newdir = pathLib.join(path, dir);

                fs.stat(newdir, (err, stat) => {
                    if (dirsCount < 0) return;

                    if (err) {
                        callback(err);
                        dirsCount = -1;
                        return;
                    }

                    dirsCount--;

                    if (!stat.isDirectory()) return;

                    getFolderSize(newdir, false, (err, cnt) => {
                        if (dirsCount < 0) return;

                        if (err) {
                            callback(err);
                            dirsCount = -1;
                            return;
                        }

                        count += cnt;

                        if (dirsCount === 0) {
                            callback(null, count);
                        }
                    })
                });
            });
        } else {
            callback(null, countFiles(arr))
        }
    });
}

class FileSystem extends EventEmitter {

    constructor(obj) {
        super();

        obj = obj || {};

        this.path = pathLib.resolve(process.cwd(), obj.path || '');

        this.uriBase = pathLib.join(this.path);
        this.uriQueue = pathLib.join(this.path, queueFolder);
        this.uriDone = pathLib.join(this.path, doneFolder);
        this.uriError = pathLib.join(this.path, errorFolder);
    }

    init(callback) {

        mkdirp(this.uriQueue, (err, made) => {
            if (err) {
                callback(err);
                return;
            }

            mkdirp(this.uriDone, (err, made) => {
                if (err) {
                    callback(err);
                    return;
                }

                mkdirp(this.uriError, (err, made) => {
                    if (err) {
                        callback(err);
                        return;
                    }

                    this.createWatch();
                    callback(null);

                });
            });
        });
    }

    createWatch() {

        this.watch = true;
        var self = this;

        if (this.watcher) {
            this.close();
        }

        this.watcher = fs.watch(this.uriQueue, (eventType, fileName) => this.onChange(eventType, fileName));

        this.watcher.on('error', (e) => {
            self.close();
        });
    }

    close() {
        this.watcher && this.watcher.close();
        this.watcher = null;
    }

    onChange(eventType, fileName) {
        if (eventType == 'change') {
            this.emit('newFile');
        }
    }


    //--> GET SIZES
    getQueueSize(callback) {
        getFolderSize(this.uriQueue, false, callback);
    }

    getDoneSize(callback) {
        getFolderSize(this.uriDone, true, callback);
    }

    getErrorSize(callback) {
        getFolderSize(this.uriError, true, callback);
    }

    //--> GET SIZES


    //--> CONTROL FILES

    checkDir(dir, callback) {

        let uriBase = pathLib.join(this.path);
        var fileSystem = this;

        fs.stat(uriBase, (err, stats) => {
            if (!err) {
                fs.stat(dir, (err, stats) => {
                    if (!err) {
                        callback(err, true);
                    } else {
                        //Create dir error
                        fs.mkdir(dir, (err) => {
                            if (!err) {
                                callback(err, true);
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
                        callback(err, true);
                    } else {
                        callback(err, false);
                    }
                });
            }
        });
    }

    saveMessage(obj, callback) {

        const uriQueue = pathLib.join(this.path, queueFolder);
        const uriFile = pathLib.join(this.path, queueFolder, obj._msgid + extension);

        var fileSystem = this;

        var error = null;

        this.checkDir(uriQueue, (err, res) => {
            if (!err) {
                fileSystem.createWatch();
                gravaFile();
            }
        });

        function gravaFile() {
            fs.writeFile(uriFile, JSON.stringify(obj), (err) => {
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

        this.checkDir(uriDone, (err, res) => {
            if (!err) {
                moveDone();
            }
        });

        function moveDone() {
            fs.stat(baseNewUri, (err, stats) => {
                error = err;

                if (!err) {
                    if (stats.isDirectory()) {
                        fs.rename(uri, newUri, (err) => {
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
                    fs.mkdir(baseNewUri, (err) => {
                        error = err;
                        if (!err) {
                            fs.rename(uri, newUri, (err) => {
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

        this.checkDir(uriError, (err, res) => {
            if (!err) {
                moveError();
            }
        });

        function moveError() {
            fs.stat(baseNewUri, (err, stats) => {
                error = err;

                if (!err) {
                    if (stats.isDirectory()) {
                        fs.rename(uri, newUriFile, (err) => {
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
                    fs.mkdir(baseNewUri, (err) => {
                        error = err;
                        if (!err) {
                            fs.rename(uri, newUriFile, (err) => {
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

    incompatibleFile(fileName, callback) {

        const uriBase = pathLib.join(this.path);
        const uriError = pathLib.join(uriBase, errorFolder);
        const uri = pathLib.join(uriBase, queueFolder, fileName);
        const baseNewUri = pathLib.join(uriError, 'incompatible');
        const newUriFile = pathLib.join(baseNewUri, fileName);

        var error = null;
        var results = null;

        this.checkDir(uriError, (err, res) => {
            if (!err) {
                moveError();
            }
        });

        function moveError() {
            fs.stat(baseNewUri, (err, stats) => {
                error = err;

                if (!err) {
                    if (stats.isDirectory()) {
                        fs.rename(uri, newUriFile, (err) => {
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
                    fs.mkdir(baseNewUri, (err) => {
                        error = err;

                        if (!err) {
                            fs.rename(uri, newUriFile, (err) => {
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

        const uriFile = pathLib.join(this.uriQueue, keyFile + extension);

        var result;

        fs.readFile(uriFile, 'utf8', (err, data) => {
            if (err) {
                callback(err);
                return;
            }

            try {
                result = JSON.parse(data);
                callback(null, result);
            } catch (e) {
                callback(e);
            }
        });
    }

    getListFiles(callback) {

        const uri = pathLib.join(this.path, queueFolder);

        var fileSystem = this;
        var error = null;
        var listFiles = [];

        fs.readdir(uri, 'utf8', (err, files) => {
            error = err;
            let fail = false;

            if (!err) {
                for (var file of files) {

                    const uriFile = pathLib.join(uri, file);
                    let extName = pathLib.extname(uriFile);

                    if (extName == extension) {
                        var baseName = pathLib.basename(uriFile, extension);
                        listFiles.push(baseName);

                    } else {
                        //Mover para erro
                        fail = true;
                        fileSystem.incompatibleFile(file, (err, res) => {
                            if (!err) {
                                callback(error, listFiles);
                            }
                        });
                    }
                }
                if (!fail) {
                    callback(error, listFiles);
                }
            }
        });
    }

    resendErrors(callback) {

        var error = null;

        var urlError = pathLib.join(this.path, errorFolder);

        var urlQueue = pathLib.join(this.path, queueFolder);

        fs.readdir(urlError, 'utf8', (err, dirs) => {

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

        fs.readdir(url, 'utf8', (err, files) => {

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
        var error = null;

        fs.stat(url, (err, stats) => {
            if (!err) {
                fs.readdir(url, 'utf8', (err, dirs) => {

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
        var error = null;

        fs.stat(url, (err, stats) => {
            if (!err) {
                fs.readdir(url, 'utf8', (err, dirs) => {
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