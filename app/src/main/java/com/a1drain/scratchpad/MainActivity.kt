package com.a1drain.scratchpad
import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
class MainActivity:AppCompatActivity(){
 private lateinit var db:JobStore
 private var activeId:Long?=null
 private lateinit var page:LinearLayout
 private val inputs=mutableListOf<EditText>()
 private val labels=listOf("Customer name","Customer phone","Service address","Invoice / job number","Work requested","Work performed","Existing conditions","Completion notes")
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);db=JobStore(this);askNotificationPermission();dashboard()}
 private fun button(label:String,run:()->Unit)=Button(this).apply{text=label;setOnClickListener{run()}}
 private fun base(title:String){page=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL;setPadding(24,28,24,24)};page.addView(TextView(this).apply{text="A-1 DRAIN CLEANING";textSize=23f});page.addView(TextView(this).apply{text=title;textSize=18f});setContentView(ScrollView(this).apply{addView(page)})}
 private fun dashboard(){base("Field App · Offline-ready");page.addView(button("New Job"){jobForm(null)});page.addView(button("Existing Jobs / Customer Search"){jobsPage()});page.addView(button("Start Floating Scratchpad"){startPad()});page.addView(button("Pending Sync"){Toast.makeText(this,"Local records are stored on this phone. Cloud sync integration is pending.",Toast.LENGTH_LONG).show()});page.addView(TextView(this).apply{text="A-1 Drain Cleaning · 206 29th St SW, Mason City, Iowa 50401 · 641-530-2728";textSize=12f})}
 private fun jobForm(job:FieldJob?){activeId=job?.id;base(if(job==null)"New Job" else "Edit Job #"+job.id);inputs.clear();val old=job?.let{listOf(it.customer,it.phone,it.address,it.invoice,it.requested,it.performed,it.conditions,it.completion)}?:List(8){""};labels.forEachIndexed{index,label->page.addView(TextView(this).apply{text=label});val input=EditText(this).apply{hint=label;setText(old[index]);if(index>=4){minLines=3;gravity=Gravity.TOP}};inputs.add(input);page.addView(input)};page.addView(button("Save Job on This Phone"){val v=inputs.map{it.text.toString().trim()}.toTypedArray();if(v[0].isBlank()||v[2].isBlank())Toast.makeText(this,"Customer name and service address are required.",Toast.LENGTH_SHORT).show() else {db.save(activeId,v);Toast.makeText(this,"Saved locally. No internet required.",Toast.LENGTH_SHORT).show();dashboard()}});page.addView(button("Cancel"){dashboard()})}
 private fun jobsPage(){base("Existing Jobs");val search=EditText(this).apply{hint="Search customer, phone, address or job number"};page.addView(search);val rows=LinearLayout(this).apply{orientation=LinearLayout.VERTICAL};page.addView(rows);fun render(q:String){rows.removeAllViews();db.all().filter{listOf(it.customer,it.phone,it.address,it.invoice).any{s->s.contains(q,true)}}.forEach{j->rows.addView(button(j.customer+" · "+j.address+"\nJob #"+(j.invoice.ifBlank{j.id.toString()})+" · "+j.syncState){jobForm(db.find(j.id))})}};search.addTextChangedListener(object:android.text.TextWatcher{override fun beforeTextChanged(s:CharSequence?,start:Int,count:Int,after:Int)=Unit;override fun onTextChanged(s:CharSequence?,start:Int,before:Int,count:Int)=render(s?.toString().orEmpty());override fun afterTextChanged(s:android.text.Editable?)=Unit});render("");page.addView(button("Dashboard"){dashboard()})}
 private fun startPad(){if(!Settings.canDrawOverlays(this)){startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION,Uri.parse("package:"+packageName)));return};ContextCompat.startForegroundService(this,Intent(this,ScratchpadService::class.java));Toast.makeText(this,"Floating scratchpad is running.",Toast.LENGTH_SHORT).show()}
 private fun askNotificationPermission(){if(Build.VERSION.SDK_INT>=33&&ContextCompat.checkSelfPermission(this,Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED)ActivityCompat.requestPermissions(this,arrayOf(Manifest.permission.POST_NOTIFICATIONS),1001)}
}