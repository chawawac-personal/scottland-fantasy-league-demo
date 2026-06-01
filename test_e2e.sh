#!/bin/bash
BASE="https://hinnvqadajjmoouvsuad.supabase.co"
ANON="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpbm52cWFkYWpqbW9vdXZzdWFkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwMTMwNzYsImV4cCI6MjA5NTU4OTA3Nn0.NWjv8E2uVaFl20l59N5DnLdTPnknU4hx5UOtjYnTJx8"
SVC="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhpbm52cWFkYWpqbW9vdXZzdWFkIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDAxMzA3NiwiZXhwIjoyMDk1NTg5MDc2fQ.QKytLkKWlWqBWaXOcc0SVVqXHvhun2FYJ4OA1C_Y_zw"

RAND=$RANDOM
TEMAIL="qatest${RAND}@scottland.demo"
TPASS="QATestPass123"

# helpers
svc(){ curl -s -X "$1" "$BASE/$2" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" -H "Content-Type: application/json" -d "$3"; }
auth(){ curl -s -X "$1" "$BASE/$2" -H "apikey: $ANON" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" ${4:+-H "Prefer: $4"} -d "$3"; }
anon(){ curl -s -X "$1" "$BASE/$2" -H "apikey: $ANON" -H "Content-Type: application/json" -d "$3"; }
code(){ curl -s -o /dev/null -w "%{http_code}" -X "$1" "$BASE/$2" -H "apikey: $ANON" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "$3"; }
jq_safe(){ python3 -c "import json,sys; d=json.load(sys.stdin); $1" 2>/dev/null; }

echo "=== SETUP: Create & login test user ==="
CU=$(svc POST "auth/v1/admin/users" "{\"email\":\"$TEMAIL\",\"password\":\"$TPASS\",\"user_metadata\":{\"username\":\"qatest$RAND\"},\"email_confirm\":true}")
TUID=$(echo "$CU" | jq_safe "print(d.get('id','FAIL'))")
echo "User uid=$TUID email=$TEMAIL"

LR=$(anon POST "auth/v1/token?grant_type=password" "{\"email\":\"$TEMAIL\",\"password\":\"$TPASS\"}")
TOK=$(echo "$LR" | jq_safe "print(d.get('access_token',''))")
echo "Token len=${#TOK}"

OTHER="5f50d3ca-91a1-4181-87e0-7285703c35eb"
PLAYER="43147ebf-658a-4fdf-aa33-37c88cbc5668"
MATCH="13dc32de-a6af-44c9-92e7-1926d5047119"

echo ""
echo "=== PHASE 3: PASSWORD RESET ==="
R=$(anon POST "auth/v1/recover" "{\"email\":\"$TEMAIL\"}")
echo "[3a] Reset valid email: $(echo $R | jq_safe "print(d.get('msg','OK 200'))")"
R=$(anon POST "auth/v1/recover" "{\"email\":\"nobody@fake.demo\"}")
echo "[3b] Reset nonexistent: $(echo $R | jq_safe "print(d.get('msg','OK 200 - no enumeration'))")"

echo ""
echo "=== PHASE 4: RBAC ==="
R=$(auth GET "rest/v1/profiles?select=username,role&id=eq.$TUID" "")
echo "[4a] Own profile: $(echo $R | jq_safe "d=d[0] if isinstance(d,list) else d; print(f\"username={d.get('username')} role={d.get('role')}\")")"

C=$(code PATCH "rest/v1/profiles?id=eq.$OTHER" "{\"bio\":\"HACKED\"}")
echo "[4b] Cross-user profile PATCH -> HTTP $C (200=SECURITY ISSUE)"

C=$(code POST "rest/v1/player_match_stats" "{\"player_id\":\"$PLAYER\",\"match_id\":\"$MATCH\",\"goals\":5,\"minutes_played\":90}")
echo "[4c] User inserts match stats -> HTTP $C (200=SECURITY ISSUE)"

C=$(code PATCH "rest/v1/matches?id=eq.$MATCH" "{\"status\":\"live\"}")
echo "[4d] User changes match status -> HTTP $C (200=SECURITY ISSUE)"

R=$(auth GET "rest/v1/notifications?select=id&user_id=eq.$OTHER" "")
COUNT=$(echo $R | jq_safe "print(len(d) if isinstance(d,list) else 0)")
echo "[4e] Read other user notifications: $COUNT rows (should be 0)"

C=$(code PATCH "rest/v1/players?id=eq.$PLAYER" "{\"is_injured\":true}")
echo "[4f] User sets player injury -> HTTP $C (200=SECURITY ISSUE)"

echo ""
echo "=== PHASE 5: CORE USER FLOWS ==="
FT=$(auth POST "rest/v1/fantasy_teams" "{\"user_id\":\"$TUID\",\"team_name\":\"QA XI\",\"formation\":\"4-3-3\"}" "return=representation")
FTID=$(echo "$FT" | jq_safe "d=d[0] if isinstance(d,list) else d; print(d.get('id','FAIL:'+str(d)[:40]))")
echo "[5a] Create fantasy team: $FTID"

R=$(auth POST "rest/v1/fantasy_team_players" "{\"fantasy_team_id\":\"$FTID\",\"player_id\":\"$PLAYER\"}" "return=minimal")
echo "[5b] Buy player: '${R:0:40}' (empty=OK)"

R=$(auth POST "rest/v1/fantasy_team_players" "{\"fantasy_team_id\":\"$FTID\",\"player_id\":\"$PLAYER\"}" "return=minimal")
echo "[5b-dup] Buy same player twice: $(echo $R | jq_safe "print('BLOCKED:'+str(d.get('code','')) if d.get('code') else 'ALLOWED')")"

R=$(auth DELETE "rest/v1/fantasy_team_players?fantasy_team_id=eq.$FTID&player_id=eq.$PLAYER" "")
echo "[5c] Sell player: '${R:0:20}' (empty=OK)"

CM=$(auth POST "rest/v1/chat_messages" "{\"user_id\":\"$TUID\",\"message\":\"QA test msg\"}" "return=representation")
CMID=$(echo "$CM" | jq_safe "d=d[0] if isinstance(d,list) else d; print(d.get('id','FAIL'))")
echo "[5d] Send chat message: $CMID"

R=$(auth DELETE "rest/v1/chat_messages?id=eq.$CMID" "")
echo "[5e] Delete own message: '${R:0:20}' (empty=OK)"

POLLID=$(curl -s "$BASE/rest/v1/polls?select=id&limit=1" -H "apikey: $ANON" | jq_safe "print(d[0]['id'] if d else '')")
if [ -n "$POLLID" ]; then
  R=$(auth POST "rest/v1/rpc/cast_poll_vote" "{\"p_poll_id\":\"$POLLID\",\"p_option\":\"Khama Billiat\"}" "")
  echo "[5f] First poll vote: $(echo $R | jq_safe "print(f\"ok={d.get('ok')}\")")"
  R=$(auth POST "rest/v1/rpc/cast_poll_vote" "{\"p_poll_id\":\"$POLLID\",\"p_option\":\"Khama Billiat\"}" "")
  echo "[5f-dup] Double vote: $(echo $R | jq_safe "print(f\"ok={d.get('ok')} err={d.get('error')}\")")"
fi

LID=$(auth GET "rest/v1/leagues?select=id&type=eq.public&limit=1" "" | jq_safe "print(d[0]['id'] if isinstance(d,list) and d else '')")
if [ -n "$LID" ]; then
  R=$(auth POST "rest/v1/league_members" "{\"league_id\":\"$LID\",\"user_id\":\"$TUID\"}" "return=minimal")
  echo "[5g] Join public league: '${R:0:40}' (empty=OK)"
fi

echo ""
echo "=== PHASE 6: EDGE CASES ==="
R=$(auth POST "rest/v1/chat_messages" "{\"user_id\":\"$TUID\",\"message\":\"\"}" "return=minimal")
echo "[6a] Empty message: $(echo $R | jq_safe "print('BLOCKED:'+str(d.get('message',''))[:60] if isinstance(d,dict) and d.get('code') else 'ALLOWED - no empty check')")"

LONGMSG=$(python3 -c "print('A'*501)")
R=$(curl -s -X POST "$BASE/rest/v1/chat_messages" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$TUID\",\"message\":\"$LONGMSG\"}")
echo "[6b] 501-char message: $(echo $R | jq_safe "print('BLOCKED: check constraint' if d.get('code') else 'ALLOWED - schema says <=500')")"

R=$(auth POST "rest/v1/fantasy_teams" "{\"user_id\":\"$TUID\",\"team_name\":\"Dupe\"}" "return=minimal")
echo "[6c] Duplicate team: $(echo $R | jq_safe "print('BLOCKED:'+str(d.get('code','')) if isinstance(d,dict) and d.get('code') else 'ALLOWED')")"

R=$(auth GET "rest/v1/profiles?id=eq.not-a-uuid" "")
echo "[6d] Invalid UUID: $(echo $R | jq_safe "print('Error:'+str(d.get('message',''))[:60] if isinstance(d,dict) and d.get('code') else str(len(d))+' rows (invalid uuid parsed as string)')")"

R=$(auth POST "rest/v1/profiles?id=eq.$TUID" "{\"username\":\"\"}" "return=minimal")
echo "[6e] Empty username update: $(echo $R | jq_safe "print('BLOCKED:'+str(d.get('message',''))[:60] if isinstance(d,dict) and d.get('code') else 'ALLOWED (no empty username check)')")"

echo ""
echo "=== CLEANUP ==="
svc DELETE "auth/v1/admin/users/$TUID" "" > /dev/null
echo "Deleted test user $TUID"
