import json,re,sys
pre=re.compile(r"^\d{4}-\d\d-\d\dT[\d:]+: ?")
out=[];cap=None;ts=None
with open("/home/hranker/.pm2/logs/quicktricks-backend-out.log","rb") as f:
    for raw in f:
        if cap is None:
            if b"Request body: {" in raw and b"Course" not in raw:
                line=raw.decode("utf-8","replace"); ts=line[:19]; cap=["{"]; prev_debug=False
            continue
        line=raw.decode("utf-8","replace").rstrip("\n")
        body=pre.sub("",line,count=1)
        cap.append(body)
        if body=="}":
            try: d=json.loads("\n".join(cap))
            except Exception: d=None
            cap=None
            if isinstance(d,dict) and ("timeTable" in d or "isTimeTable" in d or "priority" in d or ("status" in d and len(d)<=2) or "facultyDetails" in d):
                tt=d.get("timeTable")
                out.append(dict(ts=ts,title=d.get("title"),keys=sorted(d)[:40],isTT=d.get("isTimeTable"),tt=tt))
        elif len(cap)>600: cap=None
json.dump(out,open("/tmp/ttlog.json","w"))
print(len(out))
