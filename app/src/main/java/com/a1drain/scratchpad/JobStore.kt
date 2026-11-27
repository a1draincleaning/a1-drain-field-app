package com.a1drain.scratchpad
import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
data class FieldJob(val id:Long,val customer:String,val phone:String,val address:String,val invoice:String,val requested:String,val performed:String,val conditions:String,val completion:String,val syncState:String)
class JobStore(context:Context):SQLiteOpenHelper(context,"a1_field_jobs.db",null,1){
 override fun onCreate(db:SQLiteDatabase){db.execSQL("CREATE TABLE jobs (id INTEGER PRIMARY KEY AUTOINCREMENT,customer TEXT NOT NULL,phone TEXT NOT NULL DEFAULT '',address TEXT NOT NULL,invoice TEXT NOT NULL DEFAULT '',requested TEXT NOT NULL DEFAULT '',performed TEXT NOT NULL DEFAULT '',conditions TEXT NOT NULL DEFAULT '',completion TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL,sync_state TEXT NOT NULL DEFAULT 'pending')")}
 override fun onUpgrade(db:SQLiteDatabase,oldVersion:Int,newVersion:Int)=Unit
 fun save(id:Long?,v:Array<String>):Long{val cv=ContentValues().apply{put("customer",v[0]);put("phone",v[1]);put("address",v[2]);put("invoice",v[3]);put("requested",v[4]);put("performed",v[5]);put("conditions",v[6]);put("completion",v[7]);put("updated_at",System.currentTimeMillis());put("sync_state","pending")};return if(id==null)writableDatabase.insertOrThrow("jobs",null,cv) else {writableDatabase.update("jobs",cv,"id=?",arrayOf(id.toString()));id}}
 fun all():List<FieldJob>{val out=mutableListOf<FieldJob>();readableDatabase.rawQuery("SELECT * FROM jobs ORDER BY updated_at DESC",null).use{c->while(c.moveToNext())out+=FieldJob(c.getLong(0),c.getString(1),c.getString(2),c.getString(3),c.getString(4),c.getString(5),c.getString(6),c.getString(7),c.getString(8),c.getString(10))};return out}
 fun find(id:Long)=all().firstOrNull{it.id==id}
}