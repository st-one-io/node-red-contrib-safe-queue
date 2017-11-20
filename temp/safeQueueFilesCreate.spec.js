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

describe("#SafeQueue create and move files", () => {

  var obj = {};
  obj._msgid = "123456";
  obj.payload = "File Data";

  it('#Create file', (done) => {

    fileSystem.init((err) => {
      if(!err){
        fileSystem.saveMessage(obj, function (err, results) {
          if (!err) {
            if (results) {
              fileSystem.getMessage(obj._msgid, function (err, results) {
                if (!err) {
                  expect(obj.payload).to.equal(results);
                  done();
                }
              });
            }
          }
        });
      }
    });

  });

  it('#Move for Done', (done) => {

    fileSystem.doneMessage(obj._msgid, function (err, results) {
      if (!err) {
        expect(true).to.equal(results);
        done();
      }
    });

  });

  it('#Move for Error', (done) => {

    var msg = {};
    msg._msgid = "654321";
    msg.payload = "File Data";

    fileSystem.saveMessage(msg, function (err, results) {
      if (!err) {
        fileSystem.errorMessage(msg._msgid, function (err, results) {
          if (!err) {
            expect(true).to.equal(results);
            done();
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