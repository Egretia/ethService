var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Tokenbalance = {
    STATUS_FREE: 0 , // 未使用
    STATUS_USED: 1   // 已使用 
} ;

Tokenbalance.getByPage = async (page, pagesize, where, order) =>{
    if(page<1 || pagesize<1){
        return [] ;
    }

    let start = (page-1)*pagesize ;

    let where_s = [] ;
    if(where) {
        for(let i in where) {
            //{k:field,s:symbol,v:value} {k:uid,s:=,v:1}
            where_s.push(where[i].k+where[i].s+Mysql.escape(where[i].v)) ;
        }
    }

    let order_s = [] ;
    if(order) {
        for( let i in order) {
            //{k:field,d:direction} {k:uid,d:desc}
            order_s.push(order[i].k+" "+order[i].d);
        }
    }

    let sql = "select tb.*,ea.app_name from token_balance as tb left join eaddrs as ea on ea.addr=tb.addr"
    +(where_s.length>0?" where "+where_s.join(" and "):"")
    +(order_s.length>0?" order by "+order_s.join(","):"")
    +` limit ${start},${pagesize}` ;
    
    let result = await Query.sql_select(sql) ;
    if(!result || result.length<=0){
        return [] ;
    }
    return result ;
}

Tokenbalance.getTokenBySymbol = async (symbol) =>{
    let sql = "select * from tokens where token_symbol="+Mysql.escape(symbol) ;
    let result = await Query.sql_select(sql) ;
    if(!result || result.length<=0){
        return false ;
    }
    return result[0] ;
}

Tokenbalance.getAllTokens = async () =>{
    let sql = "select * from tokens" ;
    let result = await Query.sql_select(sql) ;
    if(!result || result.length<=0){
        return [] ;
    }
    return result ;
}

Tokenbalance.updateByAddressAndSymbol = async (addr, symbol, data) =>{
    let now = (new Date()).getTime();
    let sql = "select * from token_balance where addr="+Mysql.escape(addr)+" and symbol="+Mysql.escape(symbol);+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    let result2 = false;
    
    if(result && result.length>0){
        data["updated_at"] = now;
        let fields = [] ;
        for(let key in data ){
            fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
        }
        let sql = "update token_balance set "+fields.join(",")+" where addr="+Mysql.escape(addr)+" and symbol="+Mysql.escape(symbol);
        result2 = await Query.sql_update(sql) ;
    }else{
        let insertData = {
            addr:addr,
            symbol:symbol,
            balance:0,
            remain:0,
            collected:0,
            created_at:now,
            updated_at:0,
        }
        for(let key in data ){
            insertData[key] = data[key] ;
        }
        result2 = await Query.sql_insert_ex("token_balance", insertData) ;
    }

    
    return result2 ;
}

Tokenbalance.getByAddressAndSymbol = async (addr, symbol)=>{
    let sql = "select * from token_balance where addr="+Mysql.escape(addr)+" and symbol="+Mysql.escape(symbol);+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}

Tokenbalance.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();
    data["updated_at"] = 0;

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into token_balance(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = Tokenbalance;