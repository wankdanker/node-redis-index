--zrangestoreswap
local res = redis.call("zrange", KEYS[2],  ARGV[1], ARGV[2], "withscores")
local i = 1
if next(res) ~= nil then
  redis.call('del', KEYS[1])
end
while(i <= #res) do
  redis.pcall('zadd', KEYS[1], 'INCR', 1, res[i+1])
  i = i + 2
end
return #res/2
