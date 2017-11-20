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

describe("#SafeQueue Directory Check", () => {

  it('#Check dir base', (done) => {

    fileSystem.init((err) => {
      if (!err) {
        fs.stat(pathBase, function (err, stats) {
          if (!err) {
            var isDirectory = stats.isDirectory();
            expect(true).is.equal(isDirectory);
            done();
          }
        });
      }
    });

  });

  it('#Check dir queue', (done) => {

    fs.stat(dirQueue, function (err, stats) {

      var isDirectory = stats.isDirectory();

      expect(true).is.equal(isDirectory);

      done();

    });

  });

  it('#Check dir error', (done) => {

    fs.stat(dirError, function (err, stats) {

      var isDirectory = stats.isDirectory();

      expect(true).is.equal(isDirectory);

      done();

    });

  });

  it('#Check dir done', (done) => {

    fs.stat(dirDone, function (err, stats) {

      var isDirectory = stats.isDirectory();

      expect(true).is.equal(isDirectory);

      done();

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