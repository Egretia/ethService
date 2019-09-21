var Utils = require("../../utils") ;
var Query = require("./query") ;
const Mysql=require("mysql") ;

var Addr = {
    STATUS_FREE: 0 , // 未使用
    STATUS_USED: 1   // 已使用 
} ;

Addr.getByPage = async (page, pagesize, where, order) =>{
    if(page<1 || pagesize<1){
        return [] ;
    }

    let start = (page-1)*pagesize ;

    let where_s = [] ;
    if(where) {
        for(let i in where) {
            //{k:field,s:symbol,v:value} {k:uid,s:=,v:1}
            where_s.push("`"+where[i].k+"`"+where[i].s+Mysql.escape(where[i].v)) ;
        }
    }

    let order_s = [] ;
    if(order) {
        for( let i in order) {
            //{k:field,d:direction} {k:uid,d:desc}
            order_s.push("`"+order[i].k+"` "+order[i].d);
        }
    }

    let sql = "select * from eaddrs"
    +(where_s.length>0?" where "+where_s.join(" and "):"")
    +(order_s.length>0?" order by "+order_s.join(","):"")
    +` limit ${start},${pagesize}` ;
    
    let result = await Query.sql_select(sql) ;
    if(!result || result.length<=0){
        return [] ;
    }
    return result ;
}

Addr.useFreeAddr = async (appName)=>{
    let conn = await Query.atom_getconn() ;
    if (!conn){
        conn.release();
        return false ;
    }

    // begin transaction
    if(!await Query.atom_begin(conn)) {
        Utils.log.error("Failed to begin transaction") ;
        conn.release();
        return false ;
    }
    
    let ret = false ;
    try{
        
        // lock table for update
        let addrObj = await Query.atom_select("select * from eaddrs where status="+Addr.STATUS_FREE+" limit 1 for update", conn) ;
        if (!addrObj || addrObj.length<=0){
            throw new Error("no free addresses");
        }

        addrObj = addrObj[0] ;

        if(!await Query.atom_update("update eaddrs set app_name="+Mysql.escape(appName)+" , status="+Addr.STATUS_USED+" where id="+addrObj.id, conn)){
            
            throw new Error("Auction falied rollback failed");
        }

        await Query.atom_commit(conn) ;

        ret = addrObj.addr;
    }catch(e){
        
        Utils.log.error(e.message) ;
        console.error(e) ;
        await Query.atom_rollback(conn) ;
    }

    conn.release();
    return ret ;    
}

Addr.updateByAddress = async (addr, data) =>{
    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }
    let sql = "update eaddrs set "+fields.join(",")+" where addr="+Mysql.escape(addr);
    let result = await Query.sql_update(sql) ;
    return result ;
}

Addr.updateById = async (id, data) =>{
    let fields = [] ;
    for(let key in data ){
        fields.push( "`"+key+"`="+Mysql.escape(data[key]) );
    }
    let sql = "update eaddrs set "+fields.join(",")+" where id="+id;
    let result = await Query.sql_update(sql) ;
    return result ;
}

Addr.getByAddress = async (address)=>{
    let sql = "select * from eaddrs where addr="+Mysql.escape(address)+" limit 1" ;
    
    let result = await Query.sql_select(sql) ;
    
    if(result && result.length>0){
        return result[0] ;
    }else{
        return false;
    }
}

Addr.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into eaddrs(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = Addr;