const {
  expect
} = require('chai');

const os = require('os');
var fs = require('fs');
var path = require('path');
var FileSystem = require('../red/FileSystem.js');

function getDirBase() {
  var dirBase = path.join(os.tmpdir(), (Math.random() * (9999999 - 1) + 1).toString());
  return dirBase;
}

function destroyerDirBase(callback) {

  fileSystem.close();

  fileSystem.deleteQueue((err) => {
    if (!err) {
      fileSystem.deleteDone((err) => {
        if (!err) {
          fileSystem.deleteError((err) => {
            if (!err) {
              fs.rmdir(dirError, (err) => {
                if (!err) {
                  fs.rmdir(dirDone, (err) => {
                    if (!err) {
                      fs.rmdir(dirQueue, (err) => {
                        if (!err) {
                          fs.rmdir(pathBase, (err) => {
                            if (!err) {
                              callback(err);
                            } else {
                              callback(err);
                            }
                          });
                        } else {
                          callback(err);
                        }
                      });
                    } else {
                      callback(err);
                    }
                  });
                } else {
                  callback(err);
                }
              });
            } else {
              callback(err);
            }
          });
        } else {
          callback(err);
        }
      });
    } else {
      callback(err);
    }
  });
}

var pathBase = getDirBase();
var fileSystem = new FileSystem(pathBase);
var dirQueue = path.join(pathBase, 'queue');
var dirError = path.join(pathBase, 'error');
var dirDone = path.join(pathBase, 'done');

describe("#SafeQueue Delete Files", () => {

  var obj1 = {};
  obj1._msgid = "123456";
  obj1.payload = "File Data";

  var obj2 = {};
  obj2._msgid = "654321";
  obj2.payload = "File Data";


  var obj3 = {};
  obj3._msgid = "456789";
  obj3.payload = "File Data";

  it('#Delete Queue', (done) => {
    fileSystem.init((err) => {
      if (!err) {
        fileSystem.saveMessage(obj3, (err, res) => {
          if (!err) {
            fileSystem.getQueueSize((err, results) => {
              if (!err) {
                if (results > 0) {
                  fileSystem.deleteQueue((err, results) => {
                    if (!err) {
                      fileSystem.getQueueSize((err, results) => {
                        if (!err) {
                          expect(0).to.equal(results);
                          done();
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        });
      }
    });
  });

  it('#Delete Done', (done) => {

    fileSystem.saveMessage(obj1, (err, res) => {
      if (!err) {
        fileSystem.doneMessage(obj1._msgid, (err, res) => {
          if (!err) {
            fileSystem.getDoneSize((err, results) => {
              if (!err) {
                if (results > 0) {
                  fileSystem.deleteDone((err, results) => {
                    if (!err) {
                      fileSystem.getDoneSize((err, results) => {
                        if (!err) {
                          expect(0).to.equal(results);
                          done();
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        });
      }
    });
  });


  it('#Delete Error', (done) => {

    fileSystem.saveMessage(obj2, (err, res) => {
      if (!err) {
        fileSystem.errorMessage(obj2._msgid, (err, res) => {
          if (!err) {
            fileSystem.getErrorSize((err, results) => {
              if (!err) {
                if (results > 0) {
                  fileSystem.deleteError((err, results) => {
                    if (!err) {
                      fileSystem.getErrorSize((err, results) => {
                        if (!err) {
                          expect(0).to.equal(results);
                          done();
                        }
                      });
                    }
                  });
                }
              }
            });
          }
        });
      }
    });
  });

  it('#Cleaning after the test', (done) => {

    destroyerDirBase((err) => {
      if (!err) {
        done();
      }
    });

  });


});