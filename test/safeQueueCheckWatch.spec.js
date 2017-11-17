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
var fileSystem = new FileSystem(pathBase);;
var dirQueue = path.join(pathBase, 'queue');
var dirError = path.join(pathBase, 'error');
var dirDone = path.join(pathBase, 'done');

describe("#SafeQueue Watch Check", () => {

  it('#Delete dir queue', (done) => {

    fileSystem.init((err) => {
      if (!err) {
        fs.rmdir(dirQueue, (err) => {
          if (!err) {
            done();
          }
        });
      }
    });
  });

  it('#Check dir queue', (done) => {

    fs.stat(dirQueue, (err, stats) => {
      if(!err){
        expect(true).to.equal(stats.isDirectory());
        done();
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