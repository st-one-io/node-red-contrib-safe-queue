'use strict';

const fs = require('fs');
const os = require('os');
const pathLib = require('path');
const EventEmitter = require('events');
const mkdirp = require('mkdirp');

const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";
const extension = ".json";

function getDateString(date) {
    date = date || new Date();
    let day = date.getDate();
    let year = date.getFullYear();
    let month = (date.getMonth() + 1);

    return `${year}-${month}-${day}`;
}

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

            if (dirsCount === 0) {
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

function moveFile(nameFile, extensionFile, oldPath, newPath, callback) {

    let oldPathFile = pathLib.join(oldPath, nameFile + extensionFile);
    let newPathFile = pathLib.join(newPath, nameFile + extensionFile);

    fs.rename(oldPathFile, newPathFile, (err) => {
        if (err) {
            mkdirp(newPath, (err) => {
                if (err) {
                    callback(err);
                    return;
                }

                fs.rename(oldPathFile, newPathFile, (err) => {
                    if (err) {
                        callback(err);
                        return;
                    }
                    callback(err);
                });
            });
        }
        callback(err);
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
    saveMessage(obj, callback) {

        var uriFile = pathLib.join(this.uriQueue, obj._msgid + extension);

        fs.writeFile(uriFile, JSON.stringify(obj), {flags: 'rs+'}, (err) => {
            if (err) {
                mkdirp(this.uriQueue, (err, make) => {
                    if (err) {
                        console.log(make);
                        callback(err);
                    }

                    fs.writeFile(uriFile, JSON.stringify(obj), {flags: 'rs+'}, (err) => {
                        if (err) {
                            callback(err);
                            return;
                        }

                        callback(err);
                    });
                });
            }

            if (!err) {
                callback(null, true);
            }
        });
    }

    doneMessage(fileName, callback) {

        let oldPath = pathLib.join(this.uriQueue);
        let newPath = pathLib.join(this.uriDone, getDateString());

        moveFile(fileName, extension, oldPath, newPath, (err) => {
            if (err) {
                callback(err);
                return;
            }
            callback(err);
        });
    }

    errorMessage(fileName, callback) {

        let oldPath = pathLib.join(this.uriQueue);
        let newPath = pathLib.join(this.uriError, getDateString());

        moveFile(fileName, extension, oldPath, newPath, (err) => {
            if (err) {
                callback(err);
                return;
            }
            callback(err);
        });
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

    getMessageList(callback) {

        var listFiles = [];

        fs.readdir(this.uriQueue, 'utf8', (err, files) => {

            if (err) {
                callback(err);
                return;
            }

            for (var file of files) {

                const uriFile = pathLib.join(this.uriQueue, file);
                let extName = pathLib.extname(uriFile);

                if (extName === extension) {
                    var baseName = pathLib.basename(uriFile, extension);
                    listFiles.push(baseName);

                } else {
                    //Mover para erro
                    let newPath = pathLib.join(this.uriError, getDateString());
                    moveFile(baseName, extName, this.uriQueue, newPath, (err) =>{});
                }
            }
            callback(null, listFiles);
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