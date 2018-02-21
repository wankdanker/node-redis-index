local res = redis.call("zrangebylex", KEYS[2],  ARGV[1], ARGV[2])
local id, score
if next(res) ~= nil then
  redis.call('del', KEYS[1])
end
for i,v in ipairs(res) do
  redis.call('zadd', KEYS[1], 0, v)
end
return #res/2
