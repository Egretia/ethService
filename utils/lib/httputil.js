const Https = require('https');
const Http = require('http');
const Log = require("./log")


function asyncGet(protocol,url,cb) {
    let h = Http;
    if(url.substring(0,5)=="https"){
        h = Https;
    }

    h.get(url, (res) => {
        const { statusCode } = res;
        const contentType = res.headers['content-type'];

        let error;
        if (statusCode !== 200) {
            error = new Error('Request Failed.\n' +
                `Status Code: ${statusCode}`);
            
        } 
        // else if (!/^application\/json/.test(contentType)) {
        //     error = new Error('Invalid content-type.\n' +
        //         `Expected application/json but received ${contentType}`);
        // }
        if (error) {
            
            Log.error(`asyncGet failed ${url},${error.message}`);
            cb(error, null);
            return false;
        }

        res.setEncoding('utf8');
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
            cb(null, rawData);
            return true;
        });
    }).on('error', (e) => {
        Log.error(`asyncGet failed ${url},${e.message}`);
        cb(e, null);
        return false;
    });
}

function get(url) {
    return new Promise(function (resole, reject) {

        let h = Http;
        if(url.substring(0,5)=="https"){
            h = Https;
        }

        h.get(url, (res) => {
            const { statusCode } = res;
            const contentType = res.headers['content-type'];

            let error;
            if (statusCode !== 200) {
                error = new Error('Request Failed.\n' +
                    `Status Code: ${statusCode}`);
                
            } 
            // else if (!/^application\/json/.test(contentType)) {
            //     error = new Error('Invalid content-type.\n' +
            //         `Expected application/json but received ${contentType}`);
            // }
            if (error) {
                
                Log.error(`get HTTP failed ${url} ${error.message}`);
                return resole(false);
            }

            res.setEncoding('utf8');
            let rawData = '';
            res.on('data', (chunk) => { rawData += chunk; });
            res.on('end', () => {
                return resole(rawData);
                
            });
        }).on('error', (e) => {
            Log.error(`get HTTP failed ${url} ${e.message}`);
            return resole(false);
        });
    });
}

module.exports = {
    get: get,
    asyncGet: asyncGet
};