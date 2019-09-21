var Query = require("./query") ;
const Mysql=require("mysql") ;

var Addrtxlist = {
} ;

Addrtxlist.calcbalance = async (addr) =>{
    let sql = "select sum(`value`) as s from address_txlist where addr_to="+Mysql.escape(addr) ;

    let result = await Query.sql_select(sql) ;
    if(result && result.length>0){
        return result[0].s ;
    }
    return 0 ;

}

Addrtxlist.hashExists = async (hash) =>{
    let sql = "select count(*) as c from address_txlist where hash="+Mysql.escape(hash) ;
    let result = await Query.sql_select(sql) ;
    if(result && result.length>0){
        return result[0].c>0 ;
    }
    return true ;
}

Addrtxlist.getMaxBlockForAddr = async (addr)=>{
    let sql = "select max(`block_number`) as m from address_txlist where addr_to="+Mysql.escape(addr) ;
    let result = await Query.sql_select(sql) ;
    if(result && result.length>0){
        return result[0].m ;
    }
    return 0 ;
}

Addrtxlist.saveMulti = async (dataSet)=>{

    if(dataSet.length<=0){
        return false;
    }

    let fields = [] ;
    for(let key in dataSet[0] ){
        fields.push( key );
    }
    fields.push( "created_at" );
    fields.push( "updated_at" );

    let now = (new Date()).getTime(); 
    let valueSet = [] ;
    for (let i in dataSet) {
        let data = dataSet[i] ;
        data["created_at"] = now ;
        data["updated_at"] = 0;
        let values = [] ;
        for(let key in data ){
            values.push( Mysql.escape(data[key]) ) ;
        }

        valueSet.push("("+values.join(",")+")") ;
    }

    let sql = "insert into address_txlist(`"+fields.join("`,`")+"`) values"+valueSet.join(",") ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

Addrtxlist.save = async (data)=>{

    data["created_at"] = (new Date()).getTime();
    data["updated_at"] = 0;

    let fields = [] ;
    let values = [] ;
    for(let key in data ){
        fields.push( key );
        values.push( Mysql.escape(data[key]) ) ;
    }

    let sql = "insert into address_txlist(`"+fields.join("`,`")+"`) values("+values.join(",")+")" ;

    let result = await Query.sql_insert(sql) ;
    if(result){
        return result ; // insert id
    }else{
        return false ;
    }
} ;

module.exports = Addrtxlist;