# Gameplay Ability System Design Patterns

This document provides design patterns, best practices, and anti-patterns for Unreal Engine's Gameplay Ability System (GAS). Kiro should reference this document when providing GAS-related guidance.

---

## Ability Design Patterns

### Ability Lifecycle

Every Gameplay Ability follows a well-defined lifecycle. Understanding this flow is critical for correct implementation.

```
CanActivateAbility()
  → ActivateAbility()
    → CommitAbility() (apply cost & cooldown)
      → Execute logic (montage, spawn projectile, etc.)
        → EndAbility() (explicit or via montage callback)
```

**Key Points**:

- Always call `CommitAbility()` before executing the main logic — this applies cost and cooldown
- If `CommitAbility()` fails (insufficient resources), cancel the ability gracefully
- Always call `EndAbility()` when the ability finishes — failing to do so causes ability "leaks"
- Use `CancelAbility()` for external interruptions (stun, death, etc.)

### Activation Policies

| Policy | Trigger | Use Case |
|--------|---------|----------|
| `OnInputPressed` | Player presses input | Active skills (attack, dash, fireball) |
| `WhileInputActive` | Held input | Channeled abilities (charge beam, block) |
| `OnSpawn` | Actor spawns | Passive abilities (health regen, aura) |
| `OnGiven` | Ability granted | Initialization abilities (stat setup) |

**Guidelines**:

- Use `OnInputPressed` for most player-triggered abilities
- Use `OnSpawn` for passive abilities that should always be active
- `WhileInputActive` requires careful handling of `EndAbility()` on input release
- Avoid activating expensive abilities with `OnSpawn` unless truly needed at spawn time

### Instancing Policies

| Policy | Memory | Use Case |
|--------|--------|----------|
| `NonInstanced` | Lowest | Stateless abilities (simple damage, buff application) |
| `InstancedPerActor` | Medium | Abilities with per-actor state (combo counter, charge level) |
| `InstancedPerExecution` | Highest | Abilities needing independent execution state (simultaneous projectiles) |

**Guidelines**:

- Default to `InstancedPerActor` for most abilities — it balances flexibility and memory
- Use `NonInstanced` only for truly stateless abilities (no member variables used during execution)
- Use `InstancedPerExecution` sparingly — only when multiple simultaneous activations are required
- `NonInstanced` abilities cannot use `Ability Tasks` — they require instanced policies

### Cost and Cooldown

**Cost Pattern**:

Costs are applied via a Gameplay Effect with `Instant` duration:

```
GE_Cost_Fireball
├── Duration: Instant
├── Modifier:
│   ├── Attribute: Mana
│   ├── Operation: Add
│   └── Magnitude: -30.0
```

**Cooldown Pattern**:

Cooldowns are applied via a Gameplay Effect with `HasDuration`:

```
GE_Cooldown_Fireball
├── Duration: HasDuration (3.0 seconds)
├── Granted Tags:
│   └── Cooldown.Ability.Fireball
```

**Best Practices**:

- Define costs and cooldowns as separate Gameplay Effects for reusability
- Use `SetByCaller` magnitude for abilities with variable costs (e.g., charged attacks)
- Cooldown tags should follow the hierarchy: `Cooldown.Ability.[AbilityName]`
- Check cooldown with `GetCooldownTimeRemaining()` before showing UI feedback

### Ability Tasks

Ability Tasks are asynchronous operations that run within an ability's execution context.

**Common Ability Tasks**:

| Task | Purpose |
|------|---------|
| `PlayMontageAndWait` | Play animation and wait for completion/interruption |
| `WaitGameplayEvent` | Wait for a specific gameplay event |
| `WaitInputPress` / `WaitInputRelease` | Wait for player input |
| `WaitDelay` | Simple timer delay |
| `WaitTargetData` | Wait for targeting data (aim, ground target) |
| `WaitConfirmCancel` | Wait for confirm/cancel input |
| `ApplyRootMotionConstantForce` | Apply root motion for dashes/charges |

**Best Practices**:

- Always bind to both success and failure callbacks on Ability Tasks
- End the ability in failure callbacks to prevent ability leaks
- Use `WaitGameplayEvent` for decoupled communication between abilities
- Prefer `PlayMontageAndWait` over manual montage playback for proper GAS integration

---

## Gameplay Effect Design Patterns

### Duration Types

| Type | Behavior | Use Case |
|------|----------|----------|
| `Instant` | Applied once, immediately | Direct damage, healing, resource cost |
| `HasDuration` | Active for a set time | Buffs, debuffs, DoT, cooldowns |
| `Infinite` | Active until explicitly removed | Passive bonuses, equipment stats, auras |

**Guidelines**:

- Use `Instant` for one-time attribute modifications (damage, healing)
- Use `HasDuration` for temporary effects with a known duration
- Use `Infinite` for effects tied to equipment or persistent states — always ensure a removal path exists
- Periodic effects use `HasDuration` or `Infinite` with a `Period` value set

### Modifier Design

Modifiers change attribute values. The execution order matters:

```
Final Value = ((Base + Additive) × Multiplicative) + Override
```

**Modifier Operations**:

| Operation | Behavior | Example |
|-----------|----------|---------|
| `Add` | Adds to base value | +50 Health, -30 Mana |
| `Multiply` | Multiplies current value | 1.5× damage, 0.7× move speed |
| `Divide` | Divides current value | Rarely used — prefer Multiply with inverse |
| `Override` | Replaces value entirely | Set health to max, reset attribute |

**Magnitude Calculation Types**:

| Type | Use Case |
|------|----------|
| `ScalableFloat` | Fixed values, optionally scaled by curve table |
| `AttributeBased` | Derived from another attribute (e.g., damage = AttackPower × 2.5) |
| `SetByCaller` | Value set at runtime via tag (e.g., variable charge damage) |
| `CustomCalculationClass` | Complex formulas via `UGameplayEffectExecutionCalculation` |

**Best Practices**:

- Use `ScalableFloat` with Curve Tables for level-scaled values
- Use `AttributeBased` for effects that scale with character stats
- Use `SetByCaller` when the magnitude is determined at ability activation time
- Use `CustomCalculationClass` for complex damage formulas involving multiple attributes

### Stacking Strategies

| Stacking Type | Behavior | Example |
|---------------|----------|---------|
| `None` | Each application is independent | Direct damage hits |
| `AggregateBySource` | Stacks per source actor | Poison from different enemies stacks |
| `AggregateByTarget` | Stacks on the target regardless of source | Bleed stacks from any source |

**Stack Configuration**:

```
GE_Poison_Stack
├── Stacking Type: AggregateByTarget
├── Stack Limit: 5
├── Duration Refresh Policy: RefreshOnSuccessfulApplication
├── Period Reset Policy: ResetOnSuccessfulApplication
├── Stack Expiration Policy: RemoveSingleStackAndRefreshDuration
```

**Guidelines**:

- Set a `Stack Limit` to prevent unbounded stacking
- `RefreshOnSuccessfulApplication` keeps the effect alive as long as new stacks are applied
- `RemoveSingleStackAndRefreshDuration` creates a natural decay — stacks fall off one at a time
- Use `ClearEntireStack` for effects that should be fully removed on expiration

### Execution Calculations

For complex damage formulas, use `UGameplayEffectExecutionCalculation`:

```cpp
// Capture source's AttackPower and target's Armor
// Final Damage = (AttackPower × Coefficient) - (Armor × 0.5)
```

**When to Use**:

- Damage formulas involving multiple source and target attributes
- Conditional modifiers (critical hits, elemental weaknesses)
- Effects that need to read gameplay tags for conditional logic
- Any calculation too complex for simple modifier math

**Best Practices**:

- Capture attributes in the constructor using `DECLARE_ATTRIBUTE_CAPTUREDEF`
- Use `AttemptCalculateCapturedAttributeMagnitude` to safely read captured values
- Keep execution calculations focused — one per damage type or formula category
- Document the formula in code comments for designer reference

---

## Attribute Set Design Patterns

### Base Attributes vs Derived Attributes

**Base Attributes** are directly modified by Gameplay Effects:

| Attribute | Type | Description |
|-----------|------|-------------|
| `Health` | Base | Current health points |
| `MaxHealth` | Base | Maximum health capacity |
| `Mana` | Base | Current mana points |
| `MaxMana` | Base | Maximum mana capacity |
| `AttackPower` | Base | Base attack damage |
| `Armor` | Base | Damage reduction |
| `MoveSpeed` | Base | Movement speed |

**Derived Attributes** are computed from base attributes (use `Infinite` GE with `AttributeBased` modifier):

| Attribute | Formula | Description |
|-----------|---------|-------------|
| `HealthRegen` | `MaxHealth × 0.01` | Health regeneration per second |
| `CritChance` | `Dexterity × 0.5` | Critical hit chance percentage |

**Best Practices**:

- Keep Attribute Sets focused — one per system (Combat, Movement, Resources)
- Use `PostGameplayEffectExecute` to clamp values (e.g., Health between 0 and MaxHealth)
- Use `PreAttributeChange` for UI-facing value clamping (cosmetic only)
- Use `PostAttributeChange` for gameplay reactions (death trigger when Health reaches 0)

### Clamping Strategies

```cpp
void UMyAttributeSet::PostGameplayEffectExecute(const FGameplayEffectModCallbackData& Data)
{
    if (Data.EvaluatedData.Attribute == GetHealthAttribute())
    {
        SetHealth(FMath::Clamp(GetHealth(), 0.0f, GetMaxHealth()));
    }
}
```

**Clamping Rules**:

| Attribute | Min | Max | Notes |
|-----------|-----|-----|-------|
| Health | 0 | MaxHealth | Trigger death at 0 |
| Mana | 0 | MaxMana | Prevent negative mana |
| MoveSpeed | 0 | 2000 | Prevent negative or extreme speed |
| Armor | 0 | No limit | Allow stacking |
| AttackPower | 0 | No limit | Allow stacking |

### Replication

**Replication Modes for Ability System Component**:

| Mode | Behavior | Use Case |
|------|----------|----------|
| `Full` | Replicates all GEs to all clients | Player characters in competitive games |
| `Mixed` | Replicates GEs to owning client, minimal to others | Player characters in co-op games |
| `Minimal` | Minimal replication | AI-controlled characters |

**Guidelines**:

- Use `Mixed` for player characters in most games — balances bandwidth and functionality
- Use `Minimal` for AI characters — they don't need full GE replication to non-owning clients
- Use `Full` only when all clients need to see every effect on every character
- Attribute replication uses `GAMEPLAYATTRIBUTE_REPNOTIFY` macro for proper prediction support

---

## Gameplay Tag System

### Tag Hierarchy Design

Tags follow a hierarchical dot-separated naming convention. A well-designed hierarchy is critical for maintainability.

**Recommended Tag Structure**:

```
Ability
├── Ability.Melee
│   ├── Ability.Melee.LightAttack
│   ├── Ability.Melee.HeavyAttack
│   └── Ability.Melee.Combo
├── Ability.Ranged
│   ├── Ability.Ranged.Shoot
│   └── Ability.Ranged.Aim
├── Ability.Magic
│   ├── Ability.Magic.Fireball
│   ├── Ability.Magic.IceBlast
│   └── Ability.Magic.Heal
└── Ability.Movement
    ├── Ability.Movement.Dash
    ├── Ability.Movement.Jump
    └── Ability.Movement.Dodge

Cooldown
├── Cooldown.Ability.Fireball
├── Cooldown.Ability.Dash
└── Cooldown.Global.GCD

State
├── State.Dead
├── State.Stunned
├── State.Silenced
├── State.Invulnerable
├── State.Burning
├── State.Frozen
└── State.Poisoned

Damage
├── Damage.Physical
├── Damage.Fire
├── Damage.Ice
├── Damage.Electric
└── Damage.Poison

Event
├── Event.Montage.ComboWindow
├── Event.Montage.AttackHit
├── Event.Combat.Kill
└── Event.Combat.Death

GameplayCue
├── GameplayCue.Damage.Fire
├── GameplayCue.Heal
├── GameplayCue.Buff.SpeedBoost
└── GameplayCue.Impact.Metal
```

### Tag Naming Conventions

| Rule | Example | Rationale |
|------|---------|-----------|
| Use PascalCase | `Ability.Melee.LightAttack` | Consistent with UE conventions |
| Max 4 levels deep | `Ability.Magic.Fire.Fireball` | Deeper hierarchies become unwieldy |
| Category as root | `State.Stunned` not `Stunned` | Enables parent tag queries |
| Specific leaf names | `Damage.Fire` not `Damage.Type1` | Self-documenting |

### Blocking and Canceling Tags

**Activation Blocked Tags** — prevent ability activation while these tags are present:

```
GA_Fireball
├── Activation Blocked Tags:
│   ├── State.Dead
│   ├── State.Stunned
│   └── State.Silenced
```

**Cancel Abilities With Tag** — cancel active abilities with these tags when this ability activates:

```
GA_Dash
├── Cancel Abilities With Tag:
│   └── Ability.Magic (cancels all channeled spells)
```

**Block Abilities With Tag** — prevent abilities with these tags from activating while this ability is active:

```
GA_HeavyAttack
├── Block Abilities With Tag:
│   └── Ability.Movement.Dash (can't dash during heavy attack)
```

**Guidelines**:

- Use `State.*` tags for global state blocking (dead, stunned, silenced)
- Use parent tags for broad blocking (`Ability.Magic` blocks all magic abilities)
- Be explicit about cancel vs block — cancel ends active abilities, block prevents new activations
- Document tag interactions in a matrix for complex ability systems

### Owned Tags

Tags granted to the actor while an ability or effect is active:

```
GE_Buff_SpeedBoost
├── Granted Tags (Added):
│   └── State.Buffed.SpeedBoost
├── Granted Tags (Removed on expiry):
│   └── State.Buffed.SpeedBoost
```

**Use Cases**:

- Track active buffs/debuffs for UI display
- Condition checks in Behavior Trees (AI reacts to player being stunned)
- Ability prerequisites (ultimate requires 3 combo stacks)
- Immunity checks (invulnerable tag prevents damage effects)

---

## Gameplay Cues

Gameplay Cues provide visual and audio feedback for Gameplay Effects without coupling gameplay logic to presentation.

### Cue Types

| Type | Trigger | Use Case |
|------|---------|----------|
| `Static` (Notify) | Fire-and-forget | Impact effects, damage numbers, one-shot sounds |
| `Actor` (Notify) | Persistent with lifecycle | Burning VFX, shield aura, buff particles |

### Cue Tag Mapping

```
GameplayCue.Damage.Fire     → NS_Impact_Fire + SW_Impact_Fire
GameplayCue.Heal            → NS_Heal_Burst + SW_Heal
GameplayCue.Buff.SpeedBoost → NS_SpeedTrail (looping, attached)
GameplayCue.Impact.Metal    → NS_Sparks + SW_MetalHit + Decal_BulletHole
```

### Best Practices

- Always use Gameplay Cues for VFX/SFX — never spawn particles directly from ability logic
- Use `Static` cues for instant effects (impacts, damage numbers)
- Use `Actor` cues for persistent effects that need `OnActive` / `WhileActive` / `OnRemove` callbacks
- Cue tags must start with `GameplayCue.` prefix
- Keep cue logic lightweight — avoid gameplay calculations in cue handlers
- Use `Cue Parameters` to pass context (hit location, damage amount, element type)

---

## Common Anti-Patterns

### ❌ Monolithic Ability

**Problem**: A single ability handles too many responsibilities (input, animation, damage, VFX, cooldown, combo logic).

**Fix**:
1. Split into focused abilities (e.g., `GA_MeleeAttack_Light`, `GA_MeleeAttack_Heavy`)
2. Use Ability Tasks for async operations
3. Delegate VFX/SFX to Gameplay Cues
4. Use Gameplay Effects for damage and stat modifications

### ❌ Hardcoded Values in Abilities

**Problem**: Damage values, cooldown durations, and costs are hardcoded in ability Blueprints.

**Fix**:
1. Use Gameplay Effects with `ScalableFloat` or `SetByCaller` for all numeric values
2. Store ability configuration in Data Assets
3. Use Curve Tables for level-scaled values
4. Expose tuning parameters as `EditDefaultsOnly` properties

### ❌ Direct Attribute Modification

**Problem**: Modifying attributes directly (e.g., `SetHealth(Health - Damage)`) instead of using Gameplay Effects.

**Fix**:
1. Always use Gameplay Effects to modify attributes
2. This ensures proper replication, prediction, and tag/cue triggers
3. Direct modification bypasses the GAS pipeline and breaks multiplayer

### ❌ Missing EndAbility Calls

**Problem**: Abilities that don't call `EndAbility()` in all code paths, causing "zombie" abilities that block future activations.

**Fix**:
1. Ensure every code path ends with `EndAbility()`
2. Bind to both success and failure callbacks on all Ability Tasks
3. Use `OnAbilityEnded` delegate for cleanup logic
4. Test ability cancellation and interruption paths

### ❌ Tag Soup

**Problem**: Flat, unorganized tag structure with no hierarchy, making queries and maintenance difficult.

**Fix**:
1. Design tag hierarchy before implementation
2. Use category prefixes (`State.`, `Ability.`, `Damage.`, `Cooldown.`)
3. Limit hierarchy depth to 4 levels
4. Document tag purposes and interactions
5. Use `GameplayTagManager` to register tags in a centralized `.ini` file

### ❌ Ignoring Network Prediction

**Problem**: Abilities work in single-player but break in multiplayer due to missing prediction support.

**Fix**:
1. Use `ScopedPredictionWindow` for client-predicted actions
2. Apply costs and cooldowns through the GAS pipeline (auto-predicted)
3. Use `WaitNetSync` Ability Task when server confirmation is needed
4. Test abilities in multiplayer PIE (Play In Editor) with multiple clients

---

## Performance Considerations

### Ability System Component Optimization

- Set `ReplicationMode` to `Minimal` for AI characters
- Limit the number of active Gameplay Effects per actor (target: < 20 simultaneous)
- Use `Infinite` effects sparingly — each one consumes memory and replication bandwidth
- Remove expired effects promptly; don't rely solely on duration expiry for cleanup

### Tag Query Performance

- Tag container comparisons are O(n) — keep tag containers small
- Cache frequently used `FGameplayTagQuery` objects instead of constructing them each frame
- Use `HasTag` / `HasAny` / `HasAll` for simple checks; reserve `FGameplayTagQuery` for complex conditions
- Avoid tag queries in Tick functions — use tag change delegates instead

### Effect Pooling

- For frequently applied instant effects (e.g., per-bullet damage), consider using a shared `FGameplayEffectSpec` and modifying `SetByCaller` values
- Avoid creating new `UGameplayEffect` objects at runtime — define them as assets
- Use `MakeOutgoingGameplayEffectSpec` and cache the spec handle when possible
