/*
   Copyright 2017 Smart-Tech Controle e Automação

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
/* jshint node: true, esversion: 6 */

'use strict';

const fs = require('fs');
const os = require('os');
const pathLib = require('path');
const EventEmitter = require('events');
const mkdirp = require('mkdirp');
const moment = require('moment');

const queueFolder = "queue";
const doneFolder = "done";
const errorFolder = "error";
const extension = ".json";

function getDateString(date) {
    date = date || new Date();
    return moment(date).format("YYYY-MM-DD");
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

    mkdirp(path, (err) => {
        if (err) {
            callback(err);
            return;
        }

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
                        });
                    });
                });
            } else {
                callback(null, countFiles(arr));
            }
        });
    });
}

function moveFile(nameFile, extensionFile, oldPath, newPath, callback) {

    let callbackDone = false;

    function doCallback(err, data) {
        if (callbackDone) return;
        callbackDone = true;
        callback(err, data);
    }

    let oldPathFile = pathLib.join(oldPath, nameFile + extensionFile);
    let newPathFile = pathLib.join(newPath, nameFile + extensionFile);

    fs.rename(oldPathFile, newPathFile, (err) => {
        if (err) {
            mkdirp(newPath, (err) => {
                if (err) {
                    doCallback(err);
                    return;
                }

                fs.rename(oldPathFile, newPathFile, (err) => {
                    if (err) {
                        doCallback(err);
                        return;
                    }
                    doCallback(null);
                });
            });
            return;
        }
        doCallback(null);
    });
}

function deleteFile(pathFile, callback) {
    fs.unlink(pathFile, (err) => {
        callback(err);
    });
}

function deleteFilesDir(pathDir, callback) {

    let callbackDone = false;

    function doCallback(err, data) {
        if (callbackDone) return;
        callbackDone = true;
        callback(err, data);
    }


    fs.readdir(pathDir, 'utf8', (err, files) => {

        if (err) {
            doCallback(err);
            return;
        }

        var filesCount = files.length;

        if (filesCount == 0) {
            doCallback(err);
            return;
        }

        function deleteFileCallback(e) {
            if(e) {
                doCallback(e);
                return;
            }

            filesCount--;
            if (filesCount === 0) {
                doCallback(null);
            }
        }

        for (var file of files) {

            let urlFile = pathLib.join(pathDir, file);
            deleteFile(urlFile, deleteFileCallback);
        }
    });
}

function subtractDate(days, date) {

    var newDate = new Date(date);

    days = days * 24 * 60 * 60 * 1000;

    newDate = new Date(newDate.getTime() - days);

    return newDate;
}

function sumDate(days, date) {

    var newDate = new Date(date);

    days = days * 24 * 60 * 60 * 1000;

    newDate = new Date(newDate.getTime() + days);

    return newDate;
}

function deleteFilesDay(days, path, callback) {
    days = days || 0;

    let callbackDone = false;

    function doCallback(err, data) {
        if (callbackDone) return;
        callbackDone = true;
        callback(err, data);
    }

    let dateLastDir;

    if (days > 0) {
        dateLastDir = moment(subtractDate(days, new Date()));
    } else {
        dateLastDir = moment(sumDate(1, new Date()));
    }

    fs.readdir(path, 'utf-8', (err, dirs) => {
        if (err) {
            doCallback(err);
            return;
        }

        var countDirs = dirs.length;

        if (countDirs === 0) {
            doCallback(err);
            return;
        }

        dirs.forEach(dir => {
            let dayDir = moment(dir, "YYYY-MM-DD");

            if (!dayDir.isValid()) {
                countDirs--;
                return;
            }

            if (dateLastDir < dayDir) {
                countDirs--;
                return;
            }

            if (countDirs === 0) {
                doCallback(null);
                return;
            }

            let urlDir = pathLib.join(path, dir);

            deleteFilesDir(urlDir, (err) => {
                if (err) {
                    doCallback(err);
                    return;
                }

                fs.rmdir(urlDir, (err) => {
                    countDirs--;

                    if (countDirs === 0) {
                        doCallback(err);
                    }
                });
            });
        });
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
        if(this.watcher) {
            this.watcher.close();
        }
        this.watcher = null;
    }

    onChange(eventType, fileName) {
        if (eventType == 'change') {
            this.emit('newMessage');
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

        var uriFile = pathLib.join(this.uriQueue, obj.keyMessage + extension);

        fs.writeFile(uriFile, JSON.stringify(obj), {
            flags: 'rs+'
        }, (err) => {
            if (err) {
                mkdirp(this.uriQueue, (err, make) => {
                    if (err) {
                        console.log(make);
                        callback(err);
                    }

                    fs.writeFile(uriFile, JSON.stringify(obj), {
                        flags: 'rs+'
                    }, (err) => {
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

                var baseName = pathLib.basename(uriFile, extName);

                if (extName === extension) {
                    baseName = pathLib.basename(uriFile, extension);
                    listFiles.push(baseName);

                } else {
                    //Mover para erro
                    let newPath = pathLib.join(this.uriError, getDateString());
                    moveFile(baseName, extName, this.uriQueue, newPath, (err) => {});
                }
            }
            callback(null, listFiles);
        });
    }

    resendErrors(days, callback) {

        days = days || 0;

        let callbackDone = false;

        function doCallback(err, data) {
            if (callbackDone) return;
            callbackDone = true;
            callback(err, data);
        }

        let dateLastDir = 0;

        if (days > 0) {
            dateLastDir = moment(subtractDate(days, new Date()));
        }

        fs.readdir(this.uriError, 'utf8', (err, dirs) => {

            if (err) {
                doCallback(err);
                return;
            }

            var countDirs = dirs.length;

            if (countDirs === 0) {
                doCallback(null);
                return;
            }

            let totalFiles = 0;

            dirs.forEach(dir => {

                let dayDir = moment(dir, "YYYY-MM-DD");

                if (!dayDir.isValid()) {
                    countDirs--;
                    return;
                }

                if ((dateLastDir - dayDir) > 0) {
                    countDirs--;
                    return;
                }


                let urlDir = pathLib.join(this.uriError, dir);

                fs.stat(urlDir, (err, stat) => {
                    if (err) {
                        doCallback(err);
                        return;
                    }

                    if (!stat.isDirectory()) {
                        countDirs--;
                        return;
                    }

                    fs.readdir(urlDir, 'utf-8', (err, files) => {
                        if (err) {
                            doCallback(err);
                            return;
                        }

                        var countFiles = files.length;

                        if (countFiles === 0) {
                            fs.rmdir(urlDir, (err) => {
                                doCallback(err);
                            });
                            return;
                        }

                        totalFiles += countFiles;
                        countDirs--;

                        files.forEach(file => {
                            let oldFile = pathLib.join(urlDir, file);
                            let newFile = pathLib.join(this.uriQueue, file);

                            fs.stat(oldFile, (err, stat) => {
                                if (err) {
                                    doCallback(err);
                                    return;
                                }

                                if (stat.isDirectory()) {
                                    totalFiles--;
                                    return;
                                }

                                fs.rename(oldFile, newFile, (err) => {

                                    if (err) {
                                        doCallback(err);
                                        return;
                                    }

                                    totalFiles--;
                                    countFiles--;

                                    if (countFiles === 0) {
                                        fs.rmdir(urlDir, (err) => {});
                                    }

                                    if (totalFiles === 0 && countDirs === 0) {
                                        doCallback(err);
                                    }

                                });
                            });
                        });
                    });
                });
            });
        });
    }

    //--> GET FILES


    //--> DELETE FILES

    deleteQueue(callback) {
        deleteFilesDir(this.uriQueue, (err) => {
            callback(err);
        });
    }

    deleteDone(days, callback) {
        deleteFilesDay(days, this.uriDone, (err) => {
            callback(err);
        });
    }

    deleteError(days, callback) {
        deleteFilesDay(days, this.uriError, (err) => {
            callback(err);
        });
    }

    //--> DELETE FILES
}

module.exports = FileSystem;