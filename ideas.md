# Ideas to implement in app

## 1. Fast start
Users may be overwhelmed by the number of services and hardware components. We should add a "Fast start" feature that will help them to quickly create a basic homelab.

## 2. Easy onboarding
We should add a simple onboarding process that will help users to understand how to use the app.
Maybe give them a tour as well as example projects 2-3 different types of homelabs. That use real hardware components from our catalog.

## 3. Real Data implementation.
Real prices, real availability, real specs. 
Scan most popular auction sites in Poland and get real prices and availability as well as popular online shops internationally like amazon, ebay, etc.
For polish maybe use ceneo / skąpiec api.
For international maybe use amazon pa api.

## 4. Testing and validation
We should add a testing and validation system that will help users to test their homelab and validate their configuration.
Maybe use some kind of simulation or emulation to test the homelab.

## 5. Security and scalability of app
We have to validate tokens on backend with oauth2 and rate limit logging in and requests. 
Indexes on key fields (user_id, build_id, node_id, edge_id, service_id, hardware_id, etc.) should be added to speed up queries.

## 6. Affiliate links
We should add affiliate links to the shopping list. So that we can earn some money from the app.

## 7. Plan out "Pro" version
We could add "Pro" paid version that could include features like:
- AI assistant that will help users to plan their homelab (good for beginners)
- AI assistant that could find proper hardware components for the user's needs and budget.
- Store more projects (free users can store 3 projects, pro users can store 30 projects)
- Advanced IPAM features (more flexible subnetting, etc.)
- Special discord channel for pro users
- Early access to new features
- Priority support depending on subscription plan

But app would be semi free due to affiliate links and pro version.
90% of the app usage would be free and advanced users could stay on free tier where begginers would be encouraged to use pro version.

## 8. IPAM as another service
We could totally create special tool for IPAM that would be available as another serice that we will call. Separate for faster and better working still for free and with advanced features for pro users.
Separation would be better for scaling/performance and for easier development.
It would allow us to "test" networks and subnets before using them in the app and maybe warn users that their configuration is not optimal or could be better.
TODO: Research if there are any good open source IPAM tools that we could use or contribute to. Possible from top of the head: NetBox, phpIPAM, IPPlan.
