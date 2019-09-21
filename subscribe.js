const Web3 = require('web3');
const WebSocket = require("ws");
const Coder = require('web3/lib/solidity/coder');
const Http = require('http');
const Utils = require('./utils')

class Subscribe {
    constructor(){
        Utils.log.info("subscribe Header begin")
        this.alladdr = [] ; // 数据库中地址缓存
        this.tokenAddrs = [] ;

        (async()=>{
            let users = await Models.query.sql_select("select addr,app_name from eaddrs where status="+Models.addr.STATUS_USED);
            if(users){
                for(let i in users){
                    this.alladdr[users[i].addr] = users[i].app_name ;
                }
            }
        })() ;

        (async()=>{
            let tokens = await Models.tokenbalance.getAllTokens();
            if(tokens){
                for(let i in tokens){
                    this.tokenAddrs[tokens[i].token_addr] = tokens[i].token_symbol ;
                }
            }
        })() ;

        this.web3 = new Web3();
        this.web3.setProvider(new Web3.providers.HttpProvider(Config.main.subscribeHttp));
    
        this.requestId = 10 ;
        this.requests = [] ;
        this.ws = null ;

        this.ethAgent = new Utils.eth.Agent(Config.main.subscribeHttp);

        this.initWs(Config.main.subscribeWs);
    }

    isTokenAddr(addr){
        // return this.tokenAddrs.indexOf(addr)>=0 ;
        return typeof(this.tokenAddrs[addr])!="undefined" ;
    }

    addrExists(addr){
        return typeof(this.alladdr[addr])!="undefined" ;
    }

    getAddrInfo(addr){
        return this.alladdr[addr] ;
    }

    addAddr(addr,appname){
        this.alladdr[addr] = appname
    }

    dealNewBlock(newHeader,times){
        let number = this.web3.toDecimal(newHeader.number);
        Utils.log.info(`recv new header ${number}`);

        number = number-5 ;
        Utils.log.info(`try to get block ${number}`);
        this.web3.eth.getBlock(number, true, (err, blockEty)=>{
            if(err){
                console.error(`get ${number} block Entity err:`,err)
                Utils.log.error(`get ${number} block Entity err: ${err.message}`);
            }else{
                
                if(!blockEty){
                    
                    Utils.log.error(`block ${number} is null `);
                }else{
                    if(blockEty.transactions.length>0){
                        
                        for(let i in blockEty.transactions){
                            let txEty = blockEty.transactions[i] ;
                            
                            if(txEty.to){
                                if(this.addrExists(txEty.to) || this.isTokenAddr(txEty.to)){
                                    
                                    this.dealTx(txEty,1);
                                }
                            }

                            if(txEty.from){
                                if(this.addrExists(txEty.from)){
                                    /// update for collected
                                    this.updateForCollected(txEty);
                                }
                            }
                        }
                    }
                }
            }
        });
    }

    async updateForCollected(tx){
        if(tx.from){
            let addr = tx.from;
            if(tx.to && this.isTokenAddr(tx.to)){
                let contractAddr = tx.to ;
                let tokenSymbol = this.tokenAddrs[tx.to] ;
                let tokenBalance = await this.ethAgent.getERC20Balance(contractAddr, addr) ;
                Models.tokenbalance.updateByAddressAndSymbol(addr, tokenSymbol, {
                    "remain": tokenBalance,
                }) ;
            }
            let ethBalance = await this.ethAgent.getBalance(addr) ;
            Models.addr.updateByAddress(addr, {
                "remain":ethBalance
            });
        }
    }

    async notifyTransfer(tx){
        
        if(tx.to){
            let addr = tx.to ;
            let notify = false;
            if(this.addrExists(addr)){
                notify = "eth";
                Utils.log.info(`get eth tx ${tx.hash} addr ${addr} exists`) ;
            }else if(this.isTokenAddr(addr)){
                Utils.log.info(`get token tx ${tx.hash} token-addr ${addr} exists`) ;
                // erc20 supported
                let input = tx.input ;
                if(input.length<10){
                    Utils.log.info(`get token tx ${tx.hash} input.length<10`) ;
                    return ;
                }
                // check if the sign of function is a ERC20.Transfer
                if(input.substring(0,10)!="0xa9059cbb"){
                    Utils.log.info(`get token tx ${tx.hash} not a transaction`) ;
                    return ;
                }

                let params = Coder.decodeParams(["address","uint256"], input.substring(10))
                Utils.log.info(`get token tx ${tx.hash} tx data`, params) ;
                
                if(this.addrExists(params[0])){
                    addr = params[0];
                    Utils.log.info(`get token tx ${tx.hash} is a transaction, addr_to ${addr}`) ;
                    notify = "token";
                }else{
                    return;
                }
            }

            if(notify){
                
                if(notify == "token"){
                    let contractAddr = tx.to ;
                    let tokenSymbol = this.tokenAddrs[tx.to] ;
                    
                    let tokenBalance = await this.ethAgent.getERC20Balance(contractAddr, addr) ;
                    Models.tokenbalance.updateByAddressAndSymbol(addr, tokenSymbol, {
                        "remain": tokenBalance,
                    }) ;

                    let maxHeight = await Models.tokentxlist.getMaxBlockForAddr(addr) ;
                    // 查询 token tx
                    let nextHeight = maxHeight+1;
                    let logContext = {
                        "contractAddr":contractAddr,
                        "address":addr,
                        "height":nextHeight
                    } ;
                    Utils.log.error(`query token tx begin`, logContext);
                    Utils.etherscan.getTokenTxs(addr, nextHeight, async (err, response)=>{
                        
                        if(err){
                            Utils.log.error(`query token tx failed ${err.message}`, logContext);
                        }else{
                            
                            let jsonObj = JSON.parse(response) ;
                            if(!jsonObj || jsonObj.status!="1"){
                                Utils.log.error(`subscribe query token tx failed ${response}`, logContext);
                                return ;
                            }
                            Utils.log.info(`query etherscan for token-tx get result ${jsonObj.result.length} rows`, logContext);
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
                                    hash: hash ,
                                    addr_from: item.from.toLowerCase() ,
                                    addr_to: item.to.toLowerCase() ,
                                    addr_contract: item.contractAddress.toLowerCase() ,
                                    token_symbol: item.tokenSymbol.toLowerCase() ,
                                    value: this.web3.fromWei(item.value, "ether") ,
                                    confirmations: item.confirmations ,
                                    is_error: 0 ,
                                }

                                valueSet.push(data) ;
                            }
                            if(valueSet.length>0){
                                await Models.tokentxlist.saveMulti(valueSet) ;
                                this.inchargeCallback(addr, tokenSymbol) ;
                            }
                            
                        }

                        Utils.log.error(`query token tx done`, logContext);
                    }) ;

                }else{
                    // eth
                    
                    let ethBalance = await this.ethAgent.getBalance(addr) ;
                    Models.addr.updateByAddress(addr, {
                        "remain":ethBalance
                    });

                    let maxHeight = await Models.addrtxlist.getMaxBlockForAddr(addr) ;
                    // 查询 tx
                    let nextHeight = maxHeight+1;
                    let logContext = {
                        "address":addr,
                        "height":nextHeight
                    } ;
                    Utils.log.error(`query tx begin`, logContext);
                    Utils.etherscan.getTxs(addr, nextHeight, async (err, response)=>{
                        if(err){
                            Utils.log.error(`query tx failed ${err.message}`, logContext);
                        }else{
                            
                            let jsonObj = JSON.parse(response) ;
                            if(!jsonObj || jsonObj.status!="1"){
                                Utils.log.error(`subscribe query tx failed response ${addr} ${nextHeight} ${response}`);
                                return ;
                            }
                            Utils.log.info(`query etherscan for tx get result ${jsonObj.result.length} rows`, logContext);
                            let valueSet = [] ;
                            for (let j in jsonObj.result) {
                                let item = jsonObj.result[j] ;
                                let hash = item.hash.toLowerCase() ;
                                if(await Models.addrtxlist.hashExists(hash)){
                                    continue ;
                                }

                                let gasPrice = this.web3.fromWei(item.gasPrice, "ether")  ;
                                let gasUsed = parseInt(item.gasUsed) ;

                                let data = {
                                    block_number: item.blockNumber ,
                                    time_stamp: item.timeStamp ,
                                    hash: hash ,
                                    addr_from: item.from.toLowerCase() ,
                                    addr_to: item.to.toLowerCase() ,
                                    value: this.web3.fromWei(item.value, "ether") ,
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
                                await Models.addrtxlist.saveMulti(valueSet) ;
                                this.inchargeCallback(addr, 'eth') ;
                            }
                            
                        }

                        Utils.log.error(`query token tx done`, logContext);
                    }) ;
                }
                
            }
        }
        
    }

    async inchargeCallback(addr,tokenName){

        let appName = this.getAddrInfo(addr) ;
        Utils.log.info(`addr exists will call subscriber ${addr} ${appName}`);
        let appInfo = await Models.query.sql_select("select p_cb_incharge,p_key from eth_apps where p_account='"+appName+"'") ;
        if(!appInfo){
            Utils.log.error(`app not exists ${addr} ${appName}`);
            return ;
        }
        appInfo = appInfo[0]
        if(appInfo.p_cb_incharge){
            let cburl = `${appInfo.p_cb_incharge}?p_key=${appInfo.p_key}&address=${addr}&symbol=${tokenName}`;
            Http.get(cburl, (res) => {
                Utils.log.info(`incharge callback done http code : ${cburl} ${res.statusCode}`);
            }).on('error', (e) => {
                Utils.log.error(`incharge callback err: ${e.message} ${cburl}`);
            });
        }else{
            Utils.log.error(`appInfo had not configed incharge-cb ${addr}`, appInfo) ;
        }
    }

    dealTx(txEty,times){
        this.notifyTransfer(txEty);
    }

    initWs(url){
        console.log("Ws inited")
        var ws = new WebSocket(url) ;
        ws.onopen = (e)=>{
            ws.send('{"jsonrpc":"2.0", "id": 1, "method": "eth_subscribe", "params": ["newHeads"]}');
        }
        ws.onclose = (e)=>{
            console.error(e)
            console.log("ws closed,will reconnect...")
            Utils.log.info("ws closed,will reconnect...")
            ws = this.initWs(url) ;
        }
        ws.onerror = (e)=>{
            console.error(e)
            Utils.log.info("ws occured error,will reconnect..."+e.message)
            ws = this.initWs(url) ;
        }
        ws.onmessage = (e)=>{            
            try{
                let data = JSON.parse(e.data);
                
                if(data.method =='eth_subscription'){
                    // @todo 补块机制
                    this.dealNewBlock(data.params.result,1);
                }
            }catch(err){
                console.error(err);
            }
            
        }
        this.ws = ws;
    }
}

module.exports = Subscribe