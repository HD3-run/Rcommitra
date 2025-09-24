JWT best prac: 1> never store PII in tokens, JWT are base 64 encoded not encrypted , use opaque tokens outside  JWTs inside , also called Phantom Token Pattern
Client gets safe opaque token which has a reference the backend or api gateway uses that to fetch actual JWTs, result plus frontend sees nothing sensitive backend gets full user info securely .

Dont trust algo header blindly algos may get modified during use and will return null , 

Validate issuer and audience claims  ,backend should check is this token issued by our auth server? is the claim pointing to our API? 

Keep tokens short lived 

Never use JWT for sessions 


PROBLEMS WITH API CALLS : 1. with millions of products we cant send all data to network at once it may crash. sol-> Data pagination 
2. filtering products eg user puts orders of -100 units , useless api calling , solution -> input validation
3.For DB communication ORM over Raw Queries -> helps avoid SQL injection
4.Response Optimization graphql , helps page load faster when in stress. 

REST API DESIGN PRINCIPLES: validate evry access evrytime 

Always use HTTPS , TLS isnt optional encrypt in transit always , HTTP/2 reduces TLS overhead

keep secrets out of URL.

HACK prevention: sometimes hackers to get admin access , say our admin is in URL:/admin theyll put ->  URL:/%2e/admin which basically means a blank space before admin that gets them access these need to be prevented.