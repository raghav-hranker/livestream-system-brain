#!/usr/bin/env bash
# Evidence for the 28-29 Oct 2026 account misuse (quicktricks). Runs ON webserver2-2, fed over ssh:
#   ssh -i ~/.ssh/hranker-webserver2-2 hranker@148.113.49.18 'bash -s' < reference/scripts/qt_evidence_20261029.sh
# Read-only except step 0, which copies three Apache logs into ~/evidence-20261029 (mode 700) before they rotate.
# Prints no passwords, phone numbers or emails: backend-log bodies are matched on the box and only YES is printed.
APP=/var/www/backend.quicktricksbysahilsir.com/quicktricks-backend
A=/var/log/apache2/backend.quicktricksbysahilsir.com-access.log
E=~/evidence-20261029
CLIENT=6a44b54a3aed5ba9f311e601
OTHER=6a3d43f93aed5ba9f3ff2037
export PATH=/home/hranker/.nvm/versions/node/v22.22.2/bin:$PATH
hr() { printf '\n==================== %s ====================\n' "$1"; }

hr "0. Save the Apache logs (28 Oct = .log.1, 23 Oct = .log.6.gz, 29 Oct = .log)"
mkdir -p $E && chmod 700 $E
[ -e $E/28oct-access.log ] || cp -p $A.1 $E/28oct-access.log
[ -e $E/23oct-access.log.gz ] || cp -p $A.6.gz $E/23oct-access.log.gz
cp -p $A $E/29oct-access.log
ls -la $E
zcat -f $E/28oct-access.log | head -1 | cut -c1-60
zcat -f $E/23oct-access.log.gz | head -1 | cut -c1-60

hr "1. 28 Oct: logins on the client account (address, time, tool) - Apache"
zgrep -E '28/Oct/2026:(10:0[678]|10:1[69]|10:20|16:32):' $E/28oct-access.log | grep 'POST /api/users/login' | grep -E '^(106\.79\.204\.206|52\.51\.120\.197|54\.196\.194\.223|13\.222\.239\.152) '

hr "2. 28 Oct: what the script addresses requested (counts) - Apache"
zgrep -E '^(52\.51\.120\.197|54\.196\.194\.223|13\.222\.239\.152) ' $E/28oct-access.log | awk -F'"' '{split($2,r," "); sub(/\?.*/,"",r[2]); split($3,s," "); print r[1], r[2], s[1]}' | sed -E 's/[0-9a-f]{24}/<id>/g' | sort | uniq -c | sort -rn | head -20

hr "3. 23 Oct 20:09: four refused then one accepted login from 122.183.48.86 - Apache"
zgrep -E '^122\.183\.48\.86 .*23/Oct/2026:20:09' $E/23oct-access.log.gz | grep '/api/users/login'

hr "4. 29 Oct: account $OTHER recovered by OTP from a phone, then used from Amazon - Apache"
zgrep -E '^(42\.107\.141\.125|3\.83\.152\.105|54\.234\.132\.142) ' $E/29oct-access.log | grep -E '/api/users/(login|mobile-login|change-password|sendOtp)' | sed -E 's#/[0-9]{10,}#/<number>#g'

cd $APP || exit 1
hr "5. Login history from the database (time, tool) since 20 Oct"
DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -e "
const m=require('mongoose');
m.connect(process.env.MONGO_URI).then(async()=>{
  for (const id of ['$CLIENT','$OTHER']) {
    console.log('== account '+id);
    const r=await m.connection.db.collection('userloginsessions').find({user_id:new m.Types.ObjectId(id),login_time:{\$gte:new Date('2026-10-20')}},{projection:{login_time:1,device_info:1}}).sort({login_time:1}).toArray();
    r.forEach(x=>console.log('  '+new Date(x.login_time.getTime()+19800000).toISOString().slice(0,19).replace('T',' ')+'  '+String(x.device_info).slice(0,30)));
  }
  process.exit(0);
});"

hr "6. Video links issued per day to the client account - database"
DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -e "
const m=require('mongoose');
m.connect(process.env.MONGO_URI).then(async()=>{
  const r=await m.connection.db.collection('views').aggregate([{\$match:{userId:'$CLIENT',viewedAt:{\$gte:new Date('2026-09-20')}}},{\$group:{_id:{\$dateToString:{format:'%Y-%m-%d',date:'\$viewedAt',timezone:'Asia/Kolkata'}},n:{\$sum:1}}},{\$sort:{_id:1}}]).toArray();
  r.forEach(x=>console.log('  '+x._id+'  '+x.n));
  process.exit(0);
});"

hr "7. 28 Oct backend log: which login/OTP/password requests were for the client account (YES only)"
tail -c 6000000000 ~/.pm2/logs/quicktricks-backend-out.log | LC_ALL=C grep -a '^2026-10-28T' | LC_ALL=C grep -aE 'api/users/(login|mobile-login|change-password) ' | DOTENV_CONFIG_PATH=.env.development node -r dotenv/config -e "
const m=require('mongoose'); let d='';
process.stdin.on('data',c=>d+=c).on('end',async()=>{
  await m.connect(process.env.MONGO_URI);
  const u=await m.connection.db.collection('users').findOne({_id:new m.Types.ObjectId('$CLIENT')});
  const mob=String(u.mobile||''), em=String(u.email||'').toLowerCase();
  let n=0, hit=0;
  for (const l of d.split('\n')) {
    const x=/^(\S+): POST \S+(\/api\/users\/\S+) → (\d+).*? \| body: (.*)\$/.exec(l); if(!x) continue; n++;
    const g=k=>{const r=new RegExp('\"'+k+'\":\"?([^\",}]*)').exec(x[4]); return r?r[1]:'';};
    if ((mob&&(g('mobile')===mob||g('email')===mob))||(em&&g('email').toLowerCase()===em)||g('user_id')==='$CLIENT') { hit++; console.log('  '+x[1]+'  '+x[2]+'  '+x[3]+'  -> client account: YES'); }
  }
  console.log('  checked '+n+' requests on 28 Oct; '+hit+' were for the client account');
  process.exit(0);
});"
hr "done"
