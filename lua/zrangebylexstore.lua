local function massive_redis_command(command, key, t)
    local i = 1
    local temp = {}
    while(i <= #t) do
        table.insert(temp, 0)
        table.insert(temp, t[i])
        if #temp >= 4000 then
            redis.call(command, key, unpack(temp))
            temp = {}
        end
        i = i+1
    end
    if #temp > 0 then
        redis.call(command, key, unpack(temp))
    end
end
local res = redis.call("zrangebylex", KEYS[2],  ARGV[1], ARGV[2])
local id, score
if next(res) ~= nil then
  redis.call('del', KEYS[1])
end
massive_redis_command("zadd", KEYS[1], res)
return #res
