var express = require('express');
var router = express.Router();

const Utils = require("../utils");
const Web3 = require('web3');
const Models = require("../models");

const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
        console.log(err);
        next(err);
    });
};

// 该路由使用的中间件
router.use(asyncMiddleware(async (req, res, next) => {
    next();
}));

// 可用性测试
router.get('/test', async function (req, res, next) {
    
    return res.send(Utils.app.ajax_success({"msg":"success"}));
});

// 同步 ETH 事务
router.get('/synctx', async function (req, res, next) {
    // 测试函数
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let addr = Utils.app.safeGetInput(req, "addr", ""); // req.query.addr.toLowerCase() ;
    addr = addr.toLowerCase() ;

    let addrInfo = await Models.addr.getByAddress(addr) ;
    if(!addrInfo){
        return res.send(Utils.app.ajax_failed("address not exists"));
    }

    let web3 = new Web3();

    setImmediate( async function(){

        // 查询 token eth 余额
        let ethBalance = await ethAgent.getBalance(addr) ;
        Models.addr.updateByAddress(addr, {
            "remain":ethBalance
        });

        let maxHeight = await Models.addrtxlist.getMaxBlockForAddr(addr) ;
        // 查询 tx
        Utils.etherscan.getTxs(addr, maxHeight+1, async (err, response)=>{
            if(err){
                console.error(`query tx failed ${err.message}`) ;
            }else{
                
                let jsonObj = JSON.parse(response) ;
                if(!jsonObj || jsonObj.status!="1"){
                    console.error(`subscribe query tx failed response ${response}`) ;
                    return ;
                }
                let valueSet = [] ;
                for (let j in jsonObj.result) {
                    let item = jsonObj.result[j] ;
                    let hash = item.hash.toLowerCase() ;
                    if(await Models.addrtxlist.hashExists(hash)){
                        continue ;
                    }

                    let gasPrice = web3.fromWei(item.gasPrice, "ether")  ;
                    let gasUsed = parseInt(item.gasUsed) ;

                    let data = {
                        block_number: item.blockNumber ,
                        time_stamp: item.timeStamp ,
                        hash: hash ,
                        addr_from: item.from.toLowerCase() ,
                        addr_to: item.to.toLowerCase() ,
                        value: web3.fromWei(item.value, "ether") ,
                        fee: gasPrice*gasUsed,
                        gas_price: gasPrice,
                        gas_used: gasUsed,
                        confirmations: item.confirmations ,
                        is_error: item.isError ,
                        direction: 0 ,
                    }

                    valueSet.push(data) ;
                }
                if(valueSet.length>0){
                    Models.addrtxlist.saveMulti(valueSet) ;
                }
                
            }
        }) ;
    })

    return res.send(Utils.app.ajax_success({"msg":"success"}));
})

// 同步token事务
router.get('/synctokentx', async function (req, res, next) {
    // 测试函数
    let symbol = Utils.app.safeGetInput(req, "symbol", ""); // req.query.symbol.toLowerCase() ;
    symbol = symbol.toLowerCase() ;
    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let addr = Utils.app.safeGetInput(req, "addr", ""); // req.query.addr.toLowerCase() ;
    addr = addr.toLowerCase() ;

    let addrInfo = await Models.addr.getByAddress(addr) ;
    if(!addrInfo){
        return res.send(Utils.app.ajax_failed("address not exists"));
    }

    let tokenInfo = await Models.tokenbalance.getTokenBySymbol(symbol) ;
    if(!tokenInfo){
        return res.send(Utils.app.ajax_failed("token not exists"));
    }

    let web3 = new Web3();

    setImmediate( async function(){

        // 查询 token eth 余额
        let tokenBalance = await ethAgent.getERC20Balance(tokenInfo.token_addr, addr) ;
        
        Models.tokenbalance.updateByAddressAndSymbol(addr, symbol, {
            "remain": tokenBalance,
        }) ;

        let maxHeight = await Models.tokentxlist.getMaxBlockForAddr(addr) ;

        // 查询 token tx
        Utils.etherscan.getTokenTxs(addr, maxHeight+1, async function(err, response){
            if(err){
                console.error(`query token tx failed ${err.message}`) ;
            }else{
                
                let jsonObj = JSON.parse(response) ;
                if(!jsonObj || jsonObj.status!="1"){
                    console.error(`query token tx failed response ${response}`) ;
                    return ;
                }
                let valueSet = [] ;
                for (let j in jsonObj.result) {
                    let item = jsonObj.result[j] ;
                    let hash = item.hash.toLowerCase() ;
                    if(await Models.tokentxlist.hashExists(hash)){
                        continue ;
                    }
                    let data = {
                        block_number: item.blockNumber ,
                        time_stamp: item.timeStamp ,
                        hash: item.hash.toLowerCase() ,
                        addr_from: item.from.toLowerCase() ,
                        addr_to: item.to.toLowerCase() ,
                        addr_contract: item.contractAddress.toLowerCase() ,
                        token_symbol: item.tokenSymbol.toLowerCase() ,
                        value: web3.fromWei(item.value, "ether") ,
                        confirmations: item.confirmations ,
                        is_error: 0 ,
                    }

                    valueSet.push(data) ;
                }
                if(valueSet.length>0){
                    Models.tokentxlist.saveMulti(valueSet) ;
                    SubHeader.inchargeCallback(addr, symbol) ;
                }
            }
        }) ;
    })

    return res.send(Utils.app.ajax_success({"msg":"success"}));
})

router.get('/asyncaddress', async function (req, res, next) {
    // 同步现有地址

    return res.send(Utils.app.ajax_failed("not allow"));

    let ethAgent = new Utils.eth.Agent(Config.main.ethnet);
    let EGT = "0x8e1b448ec7adfc7fa35fc2e885678bd323176e34" ;
    let web3 = new Web3();

    setImmediate( async function(){

        let addrs = await Models.query.sql_select("select id,addr from token_balance ");
        if(!addrs || addrs.length<=0){
            console.error("no addr found");
            return false;
        }
        
        for (let i in addrs){
            
            let addr = addrs[i].addr ;
            let aid = addrs[i].id ;

            // 查询 egt eth 余额
            let retArr = await Promise.all([ethAgent.getERC20Balance(EGT, addr), ethAgent.getBalance(addr)]) ;
            
            let balanceEgt = retArr[0];
            let balanceEth = retArr[1];

            Models.addr.updateById(aid, {
                "remain":balanceEth
            });

            Models.tokenbalance.updateByAddressAndSymbol(addr, 'egt', {
                "remain": balanceEgt,
            }) ;

            // 查询 token tx
            Utils.etherscan.getTokenTxs(addr, 0, async function(err, response){
                if(err){
                    console.error(`query token tx failed ${err.message}`) ;
                }else{
                    console.log(response) ;
                    let jsonObj = JSON.parse(response) ;
                    if(!jsonObj || jsonObj.status!="1"){
                        console.error(`query token tx failed response ${response}`) ;
                        return ;
                    }
                    let valueSet = [] ;
                    for (let j in jsonObj.result) {
                        let item = jsonObj.result[j] ;
                        let data = {
                            block_number: item.blockNumber ,
                            time_stamp: item.timeStamp ,
                            hash: item.hash.toLowerCase() ,
                            addr_from: item.from.toLowerCase() ,
                            addr_to: item.to.toLowerCase() ,
                            addr_contract: item.contractAddress.toLowerCase() ,
                            token_symbol: item.tokenSymbol.toLowerCase() ,
                            value: web3.fromWei(item.value, "ether") ,
                            confirmations: item.confirmations ,
                            is_error: 0 ,
                        }

                        valueSet.push(data) ;
                    }

                    Models.tokentxlist.saveMulti(valueSet) ;
                }
            }) ;
        }

    })

    return res.send(Utils.app.ajax_failed("done"));
})

module.exports = router;