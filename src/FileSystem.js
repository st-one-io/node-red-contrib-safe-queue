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
                    callback(null);
                });
            });
        }
        callback(null);
    });
}

function deleteFile(pathFile, callback) {
    fs.unlink(pathFile, (err) => {
        callback(err);
    });
}

function deleteFilesDir(pathDir, callback) {

    fs.readdir(pathDir, 'utf8', (err, files) => {

        if (err) {
            callback(err);
            return;
        }

        var filesCount = files.length;

        if (filesCount == 0) {
            callback(err);
            return;
        }

        for (var file of files) {

            let urlFile = pathLib.join(pathDir, file);
            deleteFile(urlFile, (err) => {
                if (err) {
                    callback(err);
                    return;
                }
                filesCount--;
                if (filesCount === 0) {
                    callback(null);
                }
            });
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
                    moveFile(baseName, extName, this.uriQueue, newPath, (err) => {
                    });
                }
            }
            callback(null, listFiles);
        });
    }

    resendErrors(days, callback) {

        days = days || 0;

        if (days == 0) {
            fs.readdir(this.uriError, 'utf8', (err, dirs) => {

                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs === 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    let urlDir = pathLib.join(this.uriError, dir);

                    fs.stat(urlDir, (err, stat) => {
                        if (err) {
                            callback(err);
                            return;
                        }

                        fs.readdir(urlDir, 'utf-8', (err, files) => {
                            if (err) {
                                callback(err);
                                return;
                            }

                            var countFiles = files.length;

                            if (countFiles === 0) {
                                fs.rmdir(urlDir, (err) => {
                                    callback(err);
                                });
                            }

                            files.forEach(file => {
                                let oldFile = pathLib.join(urlDir, file);
                                let newFile = pathLib.join(this.uriQueue, file);

                                fs.stat(oldFile, (err, stat) => {
                                    if (err) {
                                        callback(err);
                                        return;
                                    }

                                    if (stat.isDirectory()) {
                                        return;
                                    }
                                    fs.rename(oldFile, newFile, (err) => {

                                        if (err) {
                                            callback(err);
                                            return;
                                        }

                                        countFiles--;

                                        if (countFiles === 0) {
                                            if (countDirs === 0) {
                                                callback(err);
                                            }
                                        }

                                    });
                                });
                            });
                        });
                    });
                    countDirs--;
                });
            });
        }

        if (days > 0) {

            let dateLastDir = moment().subtract(days, 'days');

            fs.readdir(this.uriError, 'utf-8', (err, dirs) => {
                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs == 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    if(countDirs <= 0){
                        callback(null);
                        return;
                    }

                    let dayDir = moment(dir, "YYYY-MM-DD");

                    if ((dateLastDir - dayDir) <= 0) {

                        let urlDir = pathLib.join(this.uriError, dir);

                        fs.stat(urlDir, (err, stat) => {
                            if (err || !stat.isDirectory()) {
                                return;
                            }

                            fs.readdir(urlDir, 'utf-8', (err, files) => {
                                if (err) {
                                    callback(err);
                                    return;
                                }

                                var countFiles = files.length;

                                if (countFiles == 0) {
                                    fs.rmdir(urlDir, (err) => {
                                        countDirs--;
                                    });
                                    return;
                                }

                                files.forEach(file => {
                                    let oldFile = pathLib.join(urlDir, file);
                                    let newFile = pathLib.join(this.uriQueue, file);

                                    fs.stat(oldFile, (err, stat) => {
                                        if (err) {
                                            callback(err);
                                            return;
                                        }

                                        fs.rename(oldFile, newFile, (err) => {

                                            if (err) {
                                                callback(err);
                                                return;
                                            }

                                            countFiles--;

                                            if (countFiles == 0) {

                                                fs.rmdir(urlDir, (err) => {
                                                    countDirs--;

                                                    if (countDirs == 0) {
                                                        callback(err);
                                                    }

                                                });
                                            }
                                        });
                                    });
                                });
                            });
                        });
                    }else{
                        countDirs--;
                    }
                });
            });
        }
    }

    //--> GET FILES


    //--> DELETE FILES
    /*
    deleteQueue(callback) {
        deleteFilesDir(this.uriQueue, (err) => {
            callback(err);
        });
    }*/

    deleteDone(days, callback) {

        days = days || 0;

        if (days == 0) {

            fs.readdir(this.uriDone, 'utf-8', (err, dirs) => {
                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs === 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    let urlDir = pathLib.join(this.uriDone, dir);

                    deleteFilesDir(urlDir, (err) => {
                        if (err) {
                            callback(err);
                            return;
                        }

                        fs.rmdir(urlDir, (err) => {
                            countDirs--;
                        });

                        if (countDirs === 0) {
                            callback(err);
                        }
                    });
                });
            });
        }

        if (days > 0) {

            let dateLastDir = moment().subtract(days, 'days');

            fs.readdir(this.uriDone, 'utf-8', (err, dirs) => {
                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs === 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    let dayDir = moment(dir, "YYYY-MM-DD");

                    if ((dayDir - dateLastDir) <= 0) {
                        let urlDir = pathLib.join(this.uriDone, dir);

                        fs.stat(urlDir, (err, stat) => {
                            if (err || !stat.isDirectory()) {
                                return;
                            }

                            deleteFilesDir(urlDir, (err) => {
                                if (err) {
                                    callback(err);
                                    return;
                                }

                                fs.rmdir(urlDir, (err) => {
                                    days--;
                                });

                                if (days === 0) {
                                    callback(err);
                                }
                            });
                        });
                    }
                });
            });
        }
    }

    deleteError(days, callback) {

        days = days || 0;

        if (days == 0) {

            fs.readdir(this.uriError, 'utf-8', (err, dirs) => {
                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs === 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    let urlDir = pathLib.join(this.uriError, dir);

                    deleteFilesDir(urlDir, (err) => {
                        if (err) {
                            callback(err);
                            return;
                        }

                        fs.rmdir(urlDir, (err) => {
                            countDirs--;
                        });

                        if (countDirs === 0) {
                            callback(err);
                        }
                    });
                });
            });
        }

        if (days > 0) {

            let dateLastDir = moment().subtract(days, 'days');

            fs.readdir(this.uriError, 'utf-8', (err, dirs) => {
                if (err) {
                    callback(err);
                    return;
                }

                var countDirs = dirs.length;

                if (countDirs === 0) {
                    callback(err);
                    return;
                }

                dirs.forEach(dir => {

                    let dayDir = moment(dir, "YYYY-MM-DD");

                    if ((dayDir - dateLastDir) <= 0) {
                        let urlDir = pathLib.join(this.uriError, dir);

                        fs.stat(urlDir, (err, stat) => {
                            if (err || !stat.isDirectory()) {
                                return;
                            }

                            deleteFilesDir(urlDir, (err) => {
                                if (err) {
                                    callback(err);
                                    return;
                                }

                                fs.rmdir(urlDir, (err) => {
                                    days--;
                                });

                                if (days === 0) {
                                    callback(err);
                                }
                            });
                        });
                    }
                });
            });
        }
    }

    //--> DELETE FILES
}

module.exports = FileSystem;