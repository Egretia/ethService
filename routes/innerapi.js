// 给内网bank提供可归集地址
var express = require('express');
var router = express.Router();

var Utils = require('../utils') ;

// 中间件：错误处理
const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.log(err);
        next(err);
    });
};
router.use(asyncMiddleware(async (req, res, next) => {
    next();
}));

// 中间件：安全性检查
const safeFilterMiddleware = (req, res, next) => {
    let queryKey = Utils.app.safeGetInput(req, "qkey", "") ;
    if(!queryKey || queryKey!=Config.main.innerQueryKey){
        return res.send(Utils.app.ajax_failed("query key wrong"));
    }
    next();
}
router.use(safeFilterMiddleware) ;

router.get('/list', async function (req, res, next) {
    let symbol = Utils.app.safeGetInput(req, "symbol", "") ;
    let appname = Utils.app.safeGetInput(req, "appname", "") ;
    if(!symbol || !appname){
        return res.send(Utils.app.ajax_failed("params wrong"));
    }
    symbol = symbol.toLowerCase() ;

    let page = Utils.app.safeGetInput(req, "page", "1") ;
    page = parseInt(page) ;
    page = page>0 ? page : 1 ;

    let pagesize = Utils.app.safeGetInput(req, "pagesize", "10") ;
    pagesize = parseInt(pagesize) ;
    pagesize = pagesize>0 ? pagesize : 10 ;

    let data = [] ;

    if(symbol=='eth'){
        let where = [
            {k:"app_name",s:"=",v:appname},
            {k:"remain",s:">",v:"0"}
        ]
        let order = [
            {k:"remain",d:"desc"}
        ]
        let result = await Models.addr.getByPage(page, pagesize, where, order) ;
        if(result.length>0){
            for(let i in result) {
                data.push({appname:result[i].app_name, address:result[i].addr, remain:result[i].remain}) ;
            }
        }
    }else{
        // "`symbol`="+Mysql.escape(symbol)
        let where = [
            {k:"ea.app_name",s:"=",v:appname},
            {k:"tb.symbol",s:"=",v:symbol},
            {k:"tb.remain",s:">",v:"0"}
        ]
        let order = [
            {k:"tb.remain",d:"desc"}
        ]
        let result = await Models.tokenbalance.getByPage(page, pagesize, where, order) ;
        if(result.length>0){
            for(let i in result) {
                data.push({appname:result[i].app_name, address:result[i].addr, remain:result[i].remain}) ;
            }
        }
    }
    
    let retObj = {
        'data': data 
    }
    res.send(Utils.app.ajax_success(retObj));
})

module.exports = router;