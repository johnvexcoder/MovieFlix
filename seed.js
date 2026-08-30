const Database=require("better-sqlite3");
const db=new Database("data/database.sqlite");
const now=new Date().toISOString();
const uuid=()=>"seed-"+Math.random().toString(36).slice(2,10);
const size=306168;
const COLS=["id","type","title","year","overview","genres","rating","maturity_rating","duration_minutes","backdrop_url","poster_url","trailer_url","tmdb_id","file_path","file_size","file_codec","file_container","file_duration_seconds","file_bitrate","video_codec","video_width","video_height","audio_codec","thumbnail_path","backdrop_path","poster_path","needs_transcode","created_at","updated_at"];
const ins = (table) => {
  const n=COLS.length;
  return `INSERT INTO ${table} (${COLS.join(",")}) VALUES (${COLS.map(()=>"?").join(",")})`;
};
const media=(vals)=>db.prepare(ins("media")).run(...vals);
db.prepare("DELETE FROM episodes").run();
db.prepare("DELETE FROM seasons").run();
db.prepare("DELETE FROM media").run();
const mov=uuid(), ser=uuid(), sea=uuid(), epi=uuid();
media([mov,"movie","Test Movie",2024,"A test movie","Drama",8.1,"PG-13",10,"","","",0,"/tmp/opencode/sample.mp4",size,"h264","mp4",10,500000,"h264",640,360,"aac","/tmp/opencode/poster.png","","",0,now,now]);
media([ser,"series","Test Series",2023,"A test series","Comedy",7.5,"TV-14",30,"","","",0,"",0,"","",0,0,"","",0,"","","",0,now,now]);
db.prepare(`INSERT INTO seasons (id,media_id,season_number,title,overview,poster_url,poster_path,tmdb_id,year,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).run(sea,ser,1,"Season 1","","","",0,2023,now);
db.prepare(`INSERT INTO episodes (id,media_id,season_id,episode_number,title,overview,duration_minutes,still_url,still_path,file_path,file_size,file_codec,file_container,file_duration_seconds,video_codec,video_width,video_height,audio_codec,tmdb_id,thumbnail_path,needs_transcode,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
 .run(epi,ser,sea,1,"Episode 1","Test episode",10,"","","/tmp/opencode/sample.mp4",size,"h264","mp4",10,"h264",640,360,"aac",0,"/tmp/opencode/poster.png",0,now);
db.prepare("DELETE FROM accounts WHERE id IN ('acct-two','acct-three')").run();
db.prepare("DELETE FROM profiles WHERE account_id IN ('acct-two','acct-three')").run();
db.prepare("INSERT INTO accounts (id,username,password_hash,is_temp,duration_hours,expires_at,created_at,updated_at) VALUES (?,?,?,1,24,?,?,?)")
 .run("acct-two","seconduser","$2b$10$hash",1,new Date(Date.now()+86400000*7).toISOString(),now,now);
db.prepare("INSERT INTO profiles (id,account_id,name,pin_hash,is_main_profile,created_at,updated_at) VALUES (?,?,?,?,?,?,?)")
 .run("prof-two-1","acct-two","Seconder",null,1,now,now);
db.prepare("DELETE FROM payment_methods").run();
db.prepare("DELETE FROM payment_submissions").run();
db.prepare("INSERT INTO payment_methods (id,name,account_number,icon_path,qr_path,is_active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
 .run("pm-1","GCash","09123456789","uploads/methods/gcash.png",null,1,0,now,now);
db.prepare("INSERT INTO payment_methods (id,name,account_number,icon_path,qr_path,is_active,sort_order,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)")
 .run("pm-2","Bank","12345","uploads/methods/bank.png",null,0,1,now,now);
db.prepare("INSERT INTO payment_submissions (id,payment_method_id,account_id,sender_name,sender_account_number,amount,reference_number,receipt_path,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
 .run("ps-john-1","pm-1","401ca623-3507-4295-adb2-ecc7b103453b","John Doe","111",500,"REF123","uploads/receipts/john1.png","pending",now,now);
db.prepare("INSERT INTO payment_submissions (id,payment_method_id,account_id,sender_name,sender_account_number,amount,reference_number,receipt_path,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)")
 .run("ps-two-1","pm-1","acct-two","Second User","222",100,"REF456","uploads/receipts/two1.png","pending",now,now);
console.log("MOVIE="+mov,"\nSERIES="+ser,"\nSEASON="+sea,"\nEPISODE="+epi);
db.close();
