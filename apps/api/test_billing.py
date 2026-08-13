import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as client:
        # First login to get access token
        resp = await client.post('http://localhost:8000/auth/login', json={'email': 'owner@acme-support.com', 'password': 'Password123!'})
        print('Login status:', resp.status_code)
        if resp.status_code == 200:
            token = resp.json().get('access_token')
            headers = {'Authorization': f'Bearer {token}'}
            sub_resp = await client.get('http://localhost:8000/billing/subscription', headers=headers)
            print('Subscription status:', sub_resp.status_code)
            print('Subscription body:', sub_resp.text)
        else:
            print('Login failed:', resp.text)

if __name__ == '__main__':
    asyncio.run(test())
