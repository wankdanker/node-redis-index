local res = redis.call("zrange", KEYS[2], ARGV[1], ARGV[2], "withscores")

if next(res) ~= nil then
  redis.call('del', KEYS[1])
end

local i = 1
local lastScore = nil

while(i <= #res) do
  if lastScore == res[i + 1] then
    redis.call('zadd', KEYS[1], res[i + 1], res[i])
  end

  lastScore = res[i + 1]
  i = i + 2
end

local count = redis.call('zcard', KEYS[1])

return count
