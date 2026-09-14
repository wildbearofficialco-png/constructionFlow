# The WildBear Way — Simulator Product Standard

## Purpose
Every WildBear simulator should feel like part of one product family while preserving the fantasy and mechanics of its industry. FleetFlow Simulator is the reference implementation. Construction Flow is the first game to be deliberately brought into parity with this standard.

## Product promise
A new player should be able to open any WildBear simulator and immediately understand the language of the product: start small, find work, allocate people/assets, watch work progress, get paid, absorb realistic problems, reinvest, expand, and eventually run an empire.

Industry mechanics change. Product grammar does not.

## The shared WildBear loop
1. Start with a small but viable business and a clear identity.
2. Find understandable work with visible reward, requirements, risk, and duration.
3. Allocate the right people, assets, inventory, and/or capital.
4. Start work and show meaningful progress over time.
5. Resolve success, failure, delays, quality, and unexpected events.
6. Pay or collect realistic operating costs and revenue.
7. Update reputation, relationships, experience, history, and business health.
8. Reinvest in people, equipment/property, capacity, territory, and systems.
9. Let the business continue believably while the player is away.
10. Escalate from operator to manager to owner/CEO/empire builder.

## Shared systems required in every simulator
### Company identity
- owner and company naming
- recognizable company status/header
- reputation and progression
- history/milestones
- company value/net worth when appropriate

### Work marketplace
- open opportunities
- eligibility/requirements
- understandable economics before commitment
- competition or market pressure
- progress state
- completion/failure state
- client/customer relationship consequences

### People
- hiring/recruiting
- wages/payroll
- skill/role differences
- fatigue/availability where relevant
- morale/loyalty/personality where relevant
- quits/no-shows/performance events where relevant

### Assets
- purchase/acquisition
- assignment/use
- condition/wear
- maintenance/repair
- operating costs
- resale/replacement
- downtime

### Finance
- cash
- income and expenses
- transaction ledger/history
- lending/credit
- recurring obligations
- taxes/insurance where appropriate
- clear recovery path from financial stress
- financing proceeds must not masquerade as operating revenue

### Living economy
- regional or market demand
- regional/market costs
- wage pressure
- financing climate
- pricing movement
- events that affect economics
- displayed price and charged price must use the same calculation path

### Competition
- believable named competitors/rivals
- pressure on opportunities/prices/market share
- visible competitive position
- events/headlines/interactions
- deeper investment/acquisition mechanics only where they improve the fantasy

### Events and decisions
- opportunities
- operational problems
- people problems
- market changes
- delayed consequences where useful
- clear player choices rather than random punishment without context

### Offline progression
- save timestamp
- capped believable elapsed-time processing
- active work progresses or resolves correctly
- costs and deterioration remain coherent
- return summary explains what happened
- no unlimited-money exploits from long absences

### Progression
- obvious first upgrade
- short-term goals
- medium expansion path
- late-game management layer
- territories/branches/locations where appropriate
- empire/endgame/prestige only after the core business is satisfying

## Shared WildBear visual language
All simulator titles should converge on the same design grammar:
- consistent typography hierarchy
- consistent spacing scale
- consistent card radius/border treatment
- consistent positive/warning/danger/info semantics
- consistent money/percentage/time formatting
- consistent button hierarchy
- consistent progress indicators
- consistent alerts and confirmation behavior
- consistent empty states with a next action
- consistent bottom-navigation philosophy
- consistent onboarding/tip presentation
- consistent offline-return presentation
- consistent Finance presentation
- consistent Settings/presentation controls
- readable on iPhone and iPad
- important information visible without digging

The industry supplies imagery, terminology, icons, and special mechanics. WildBear supplies the interface language.

## First-minute rule
Within 60 seconds a fresh player must know:
- who they are
- what business they own
- what action makes money
- what they need to start that action
- where to tap next

No simulator passes product review if this is unclear.

## First-20-minute rule
A fresh player should:
- complete the industry's core activity at least once
- understand how profit is created
- encounter at least one meaningful decision
- see an attainable upgrade
- avoid accidental progression dead ends
- understand at least one reason to return later

## Save/offline rule
Before release, verify persistence for company identity, staff, assets, active work, finances, settings, progression, and industry-specific state. Verify short and long offline gaps. Migration must preserve old saves whenever reasonably possible.

## Failure-state rule
Financial trouble, damaged assets, tired/unavailable workers, overdue obligations, failed work, and other setbacks must be understandable and have an intentional recovery path unless the design explicitly calls for game over.

## Quality gate
Before a WildBear simulator is release-ready:
1. clean launch passes
2. first minute passes
3. core loop passes end-to-end
4. save/load passes
5. offline progression passes
6. failure/recovery states pass
7. first 20 minutes pass
8. iPhone and iPad UI clarity pass
9. automated tests pass
10. lint/typecheck pass
11. Expo Doctor passes
12. Snack/Expo Go test build passes when that workflow is used
13. known issues are documented
14. release configuration is reviewed separately and only changed with owner approval

## Architecture direction
Treat FleetFlow Simulator as the reference implementation, not a file to clone blindly. New games should increasingly separate:

WildBear Core
- formatting and presentation primitives
- save/offline contracts
- finance/ledger conventions
- lending conventions
- regional economy interfaces
- progression conventions
- event/decision conventions
- test contracts

Industry Module
- work types
- industry assets
- industry staff/roles
- industry costs
- industry events
- industry progression fantasy

Game Presentation
- title-specific terminology, images, content, balancing, and flavor

Shared code should be extracted only when behavior is genuinely common and stable. Avoid premature abstraction that makes one game's mechanics awkward.

## Reference mapping
### FleetFlow Simulator
Core fantasy: logistics operator → fleet manager → logistics CEO.
Work: jobs/routes/contracts.
People: drivers/staff.
Assets: vehicles/branches/properties.
Industry pressure: fuel, wear, traffic, client terms, delivery requirements.

### Construction Flow
Core fantasy: contractor → project manager → construction company owner → construction empire.
Work: bids/contracts/projects/phases.
People: crew/project staff/subcontractor-style roles.
Assets: construction equipment/vehicles/offices/yards.
Industry pressure: materials, equipment wear, weather, delays, inspections, theft, change orders, unpaid/slow-paying clients.

### Real Estate Flow
Core fantasy: small investor/agent → portfolio operator → real-estate empire.
Work: listings/deals/renovations/leases.
People: agents/contractors/property staff.
Assets: properties.
Industry pressure: financing, vacancy, maintenance, appreciation, tenants, market cycles.

### Restaurant Flow
Core fantasy: owner-operator → multi-location restaurateur.
Work: service/demand/events/contracts where appropriate.
People: kitchen/front-of-house/management.
Assets: equipment/location/upgrades.
Industry pressure: ingredients, spoilage, staffing, reviews, demand, inspections.

## Governance
For future feature proposals, ask two questions:
1. Is this a WildBear Core behavior that should feel consistent across games?
2. Or is this industry-specific behavior that should make this game distinct?

If it is Core, match the WildBear Way. If it is industry-specific, preserve the shared grammar but let the game be itself.
