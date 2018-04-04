local function massive_redis_command(command, key, t)
    local i = 1
    local temp = {}
    local lastScore = nil
    while(i <= #t) do
        if lastScore == t[i + 1] then
          table.insert(temp, t[i + 1])
          table.insert(temp, t[i])
        end

        if #temp >= 4000 then
            redis.call(command, key, unpack(temp))
            temp = {}
        end

        lastScore = t[i + 1]
        i = i + 2
    end
    if #temp > 0 then
        redis.call(command, key, unpack(temp))
    end
end
local res = redis.call("zrange", KEYS[2], ARGV[1], ARGV[2], "withscores")
if next(res) ~= nil then
  redis.call('del', KEYS[1])
end
massive_redis_command("zadd", KEYS[1], res)
local count = redis.call('zcard', KEYS[1])
return count
