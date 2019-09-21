const { URLSearchParams } = require('url');
const Httputil = require("./httputil");
const Log = require("./log")

function getTokenTxs(address,startblock,cb) {

    let etherscanHost = Config.main.ethserscan ;
    let etherscanKey = Config.main.ethserscanKey ;

    let params = new URLSearchParams();
    params.append('module', 'account');
    params.append('action', 'tokentx');
    params.append('address', address);
    params.append('startblock', startblock);
    params.append('endblock', 999999999);
    params.append('sort', 'asc');
    params.append('apikey', etherscanKey) ;
    let url = etherscanHost+"/api?"+params.toString();
    Httputil.asyncGet("http", url, cb) ;
}

function getTxs(address,startblock,cb) {

    let etherscanHost = Config.main.ethserscan ;
    let etherscanKey = Config.main.ethserscanKey ;

    let params = new URLSearchParams();
    params.append('module', 'account');
    params.append('action', 'txlist');
    params.append('address', address);
    params.append('startblock', startblock);
    params.append('endblock', 999999999);
    params.append('sort', 'asc');
    params.append('apikey', etherscanKey) ;
    let url = etherscanHost+"/api?"+params.toString();
    Httputil.asyncGet("http", url, cb) ;
}

module.exports = {
    getTokenTxs:getTokenTxs,
    getTxs:getTxs
}