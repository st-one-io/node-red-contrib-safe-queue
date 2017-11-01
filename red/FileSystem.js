const fs = require('fs');

class FileSystem {

    constructor(path) {
        this.path = path;
        console.log("Create FileSystem - path: " + this.path);
    }


    saveMessage(obj, callback) {
        const uri = this.path + "queue/" + obj._msgid + ".json";
        fs.writeFile(uri, JSON.stringify(obj.payload), callback);
    }

    getMessage(obj, callback){
        const uri = this.path + "queue/" + obj;
        fs.readFile(uri , 'utf8', callback);
    }

    getListFiles(callback){
        const uri = this.path + "queue/";
        fs.readdir(uri, 'utf8', callback);
    }

    getQueueSize(){
        const uri = this.path + "queue/";
        var cont = fs.readdirSync(uri, 'utf8').length;
        return cont;
    }

    deleteMessage(obj){
        
        var date = new Date (Date.now());
       
        var day = date.getDate();
        var year = date.getFullYear();
        var month = (date.getMonth() + 1);

        const uri = this.path + "queue/" + obj;
        const baseNewUri = this.path + "done/" + year + "-" + month + "-" + day + "/";
        const newUri = baseNewUri + obj;

        if(!fs.existsSync(baseNewUri)){
            fs.mkdir(baseNewUri, function(err){
                if(!err){
                    console.log("create repository");
                }else{
                    console.log("-->mkdir_error: " + err );
                }
            });
        }

        fs.rename(uri, newUri, function(err){
            if(!err){
                console.log("deleteMessage");
            }else{
                console.log("-->raneme_error: " + err );
            }
        });

    }

}

module.exports = FileSystem;