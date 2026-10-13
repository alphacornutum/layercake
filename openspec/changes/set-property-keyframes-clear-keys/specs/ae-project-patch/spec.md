# Spec Delta

## MODIFIED Requirements

### Requirement: Property keyframe operation replaces a complete timeline or restores a sampled static value

The operation MUST accept exactly one desired state: a non-empty complete `keyframes` timeline, `staticValueAtTime` in composition seconds, or `clearKeys`. The timeline MUST replace all existing keys; static mode MUST sample the authored value at the supplied time before removing keys and restore it as the static value; clear mode MUST remove all existing keys without writing any value. Empty desired timelines and simultaneous or absent desired-state fields MUST be rejected.

#### Scenario: Replace complete timeline

- **WHEN** `keyframes` contains ordered time/value entries
- **THEN** the operation MUST leave the target property with exactly those keys and no omitted prior keys

#### Scenario: Remove keys and restore sampled value

- **WHEN** `staticValueAtTime` is supplied
- **THEN** the operation MUST sample the authored pre-expression value at that composition time, remove the target property's keys, and restore that sample as its static value

#### Scenario: Remove keys without writing a value

- **WHEN** `clearKeys` is supplied
- **THEN** the operation MUST remove the target property's keys and MUST NOT write any value to the property

#### Scenario: Reject ambiguous desired state

- **WHEN** more than one of `keyframes`, `staticValueAtTime`, and `clearKeys` is supplied, none is supplied, or desired `keyframes` is empty
- **THEN** validation MUST fail before mutation

#### Scenario: Reject unsupported property values

- **WHEN** the property type or supplied value is not in the supported finite numeric scalar/vector/color domain or has a mismatched dimension
- **THEN** the operation MUST refuse before mutation with a clear unsupported-type or invalid-value error

## ADDED Requirements

### Requirement: Property keyframe clear mode works without writing a value

`clearKeys` MUST remove every key on the target property without attempting any value write, so the operation remains usable when After Effects considers the property or a parent property hidden and refuses value writes. The result MUST report the value the property actually retains after clearing as read-back evidence and MUST NOT present it as a sampled or restored value. A property that already has zero keys MUST be reported as already satisfied, subject to the expression policy.

#### Scenario: Hidden property cleared

- **WHEN** the target property is hidden (value writes are refused) and carries keys, and `clearKeys` is supplied
- **THEN** the operation MUST succeed without attempting a value write, leave the property with zero keys, and report zero keys

#### Scenario: Retained value reported as-is

- **WHEN** keys are removed in clear mode
- **THEN** evidence MUST report the value the property retained after clearing, labeled as retained rather than sampled or restored, because After Effects chooses it (observed as the last key's value on a hidden property)

#### Scenario: Clear mode on a visible property

- **WHEN** `clearKeys` is supplied for a property that accepts value writes
- **THEN** the operation MUST follow the same semantics: remove every key, write no value, and report the retained value

#### Scenario: Clear request with no keys is a no-op

- **WHEN** `clearKeys` is supplied and the target property already has zero keys
- **THEN** the operation MUST report already satisfied without mutation, subject to expression handling

### Requirement: Property keyframe static restore failure restores removed keys in place

When the static restore write fails after keys were removed, the operation MUST attempt to restore the removed keys in place from the captured before-state, verify the restored timeline by re-reading it, and report the original failure together with the restore attempt and its verification outcome. The operation MUST NOT rely on batch undo as the only recovery for this path.

#### Scenario: Restore verified after refused write

- **WHEN** the static restore write is refused after keys were removed, for example because the property is hidden
- **THEN** the operation MUST fail, restore the removed keys from the captured before-state, verify the restored timeline by re-reading it, and report the original error with restore attempt and verification evidence

#### Scenario: Restore not verified reports honestly

- **WHEN** the removed keys cannot be restored or the restored timeline cannot be verified
- **THEN** the operation MUST report the actual readable post-state and that restoration was not verified, without claiming success
