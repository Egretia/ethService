var express = require('express');
var router = express.Router();

const Utils = require("../utils");
const Models = require("../models");

const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.log(err);
        next(err);
    });
};

// 该路由使用的中间件，service 是内网使用的接口，不对外提供服务，nignx 负责访问控制
router.use(asyncMiddleware(async (req, res, next) => {
    next();
}));

router.get('/getethbalance', async function (req, res, next) {

    let address = Utils.app.safeGetInput(req, "address", ""); // req.query.address;
    let appname = Utils.app.safeGetInput(req, "appname", ""); // req.query.appname;

    if (!address || !appname) {
        return res.send(Utils.app.ajax_failed("params wrong"));
    }

    let addrinfo = await Models.addr.getByAddress(address);

    if (!addrinfo) {
        return res.send(Utils.app.ajax_failed("address not found"));
    }

    if (addrinfo.app_name != appname) {
        return res.send(Utils.app.ajax_failed("address doesn't belong this app"));
    }

    let eth_balance = await Models.addrtxlist.calcbalance(address)

    let retObj = {
        'eth_balance': parseFloat(eth_balance)
    }
    res.send(Utils.app.ajax_success(retObj));
})

router.get('/gettokenbalance', async function (req, res, next) {

    let address = Utils.app.safeGetInput(req, "address", ""); // req.query.address;
    let appname = Utils.app.safeGetInput(req, "appname", ""); // req.query.appname;
    let symbol = Utils.app.safeGetInput(req, "symbol", ""); // req.query.symbol;

    if (!address || !appname) {
        return res.send(Utils.app.ajax_failed("params wrong"));
    }

    let addrinfo = await Models.addr.getByAddress(address);

    if (!addrinfo) {
        return res.send(Utils.app.ajax_failed("address not found"));
    }

    if (addrinfo.app_name != appname) {
        return res.send(Utils.app.ajax_failed("address doesn't belong this app"));
    }

    let balance = await Models.tokentxlist.calcbalance(address, symbol) ;
    
    let retObj = {
        'balance': parseFloat(balance)
    }
    res.send(Utils.app.ajax_success(retObj));
})

router.get('/getegtbalance', async function (req, res, next) {

    let address = Utils.app.safeGetInput(req, "address", ""); // req.query.address;
    let appname = Utils.app.safeGetInput(req, "appname", ""); // req.query.appname;
    let symbol = 'egt' ;

    if (!address || !appname) {
        return res.send(Utils.app.ajax_failed("params wrong"));
    }

    let addrinfo = await Models.addr.getByAddress(address);

    if (!addrinfo) {
        return res.send(Utils.app.ajax_failed("address not found"));
    }

    if (addrinfo.app_name != appname) {
        return res.send(Utils.app.ajax_failed("address doesn't belong this app"));
    }

    let egt_balance = await Models.tokentxlist.calcbalance(address, symbol) ;
    
    let retObj = {
        'egt_balance': parseFloat(egt_balance)
    }
    res.send(Utils.app.ajax_success(retObj));
})

router.get('/newethaccount', async function (req, res, next) {

    let appname = Utils.app.safeGetInput(req, "appname", ""); // req.query.appname;
    let key = Utils.app.safeGetInput(req, "key", ""); // decodeURI(req.query.key);
    if (!key || !appname) {
        return res.send(Utils.app.ajax_failed("params wrong"));
    }

    let appInfo = await Models.apps.getByAccount(appname) ;
    if(appInfo.p_key!=key){
        return res.send(Utils.app.ajax_failed("key wrong"));
    }

    let addr = await Models.addr.useFreeAddr(appname) ;
    if(!addr) {
        return res.send(Utils.app.ajax_failed("no free address"));
    }

    SubHeader.addAddr(addr, appname) // 将地址添加到块列表，用来快速排查以太坊出块是否跟我们有关系

    let retObj = {
        "msg": "success",
        "address": addr
    };

    res.send(Utils.app.ajax_success(retObj));
});

// @todo 手动同步TOKEN余额



module.exports = router;
