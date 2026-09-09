# panel

## 0.9.1

### Patch Changes

- Fixed UUID issue

## 0.9.0

### Minor Changes

- ### Network Management (New Tab)
    - Added a new **Network Tab** that automatically extracts IP and MAC addresses from uploaded DuoTecno `projectnodeservices.json` and `cameras.json` files.
    - Grouped IPs intelligently by subnet into collapsible UI cards featuring a clean, borderless "soft pop" aesthetic.
    - Implemented a secure backend API (`/api/projects/ips`) for persisting manual IP additions and overrides independently from general project metadata.
    - Enabled manual device renaming for auto-extracted IPs. The system securely links your custom names via MAC addresses so they survive future programmation file updates.
    - Created a native backend `/api/ping` endpoint to securely bypass browser ICMP restrictions.
    - Added a **"Ping All"** subnet action and individual ping buttons alongside devices to test live reachability across the network with visual health indicators.

    ### Global Action Dock
    - Consolidated all contextual actions (Save, Refresh, Upload, New Group, Add IP, etc.) from the individual tab headers down into a unified, floating action dock at the bottom of the project page (`page.tsx`) for cleaner UI navigation.

    ### Input Copy Capabilities
    - Enhanced the global `Input` UI component with `copyable` and `viewable` props, supported by a new dedicated `CopyButton.tsx`.
    - Refactored read-only metadata fields across `Login.tsx`, `Address.tsx`, and `Contact.tsx` to use disabled inputs with 1-click clipboard copy support, ensuring visual consistency between edit and view modes.

## 0.8.1

### Patch Changes

- Fixed some UI elements and moved some UI elements

## 0.8.0

### Minor Changes

- Added new feed feature for live feed about domotica systems

## 0.7.1

### Patch Changes

- Fixed 2 and 4 buttons render

## 0.7.0

### Minor Changes

- Added modules Essence and Velocity

## 0.6.2

### Patch Changes

- Added new tab in projects, controls

## 0.6.1

### Patch Changes

- Fixed an issue where print buttons were not displaying their location

## 0.6.0

### Minor Changes

- Added redirect when local

## 0.5.3

### Patch Changes

- fixed loading

## 0.5.2

### Patch Changes

- Fixed loading times

## 0.5.1

### Patch Changes

- fixed some ui elements

## 0.5.0

### Minor Changes

- Added new module and fixed some printing in canbus

## 0.4.5

### Patch Changes

- fixed invite page

## 0.4.4

### Patch Changes

- Fixed permissions

## 0.4.3

### Patch Changes

- new domain

## 0.4.2

### Patch Changes

- Fixed email padding

## 0.4.1

### Patch Changes

- Fixed some issues

## 0.4.0

### Minor Changes

- Added task material stages and fixed a Selector bug where the screen would flash

## 0.3.10

### Patch Changes

- Fixed search in /projects, added names to simulation nodes in canbus, fixed dock on projects for mobile

## 0.3.9

### Patch Changes

- Fix viewbox of the serenity buttons

## 0.3.8

### Patch Changes

- Added serenity modules

## 0.3.7

### Patch Changes

- buttona

## 0.3.6

### Patch Changes

- Fixed issues in solar and canbus

## 0.3.5

### Patch Changes

- Updated Canbus and overview

## 0.3.4

### Patch Changes

- Added and Fixed some items

    - Added templates page
    - Added simulation mode in canbus
    - Added the ability to have multiple buses on a project
    - Fixed an issue where Solar integration with fusionsolar wasn't working properly
    - Fixed an issue where tasks permission was not really working

## 0.3.3

### Patch Changes

- Added grouping to schemas as well

## 0.3.2

### Patch Changes

- Reworked Documents to allow folders

## 0.3.1

### Patch Changes

- Removed obsolete email API route.

## 0.3.0

### Minor Changes

- Added Ticket Templates to settings and ticket creation workflow. Admins can now define standard points of interest (POIs) that can be easily applied when creating new tickets.

## 0.2.14

### Patch Changes

- Fixed infinite loop on events page

## 0.2.13

### Patch Changes

- updated mail picture sourcing

## 0.2.12

### Patch Changes

- Update config files

## 0.2.11

### Patch Changes

- Added a conditional Force Update button to the General Settings view that only renders when a user's session has Debug Mode enabled.

## 0.2.10

### Patch Changes

- Added dynamic panel CSS grid generation, fixed FusionSolar live data UI rendering order, moved the live data yield under the Google Map component, attached live FusionSolar JSON parsing directly to Debug Mode context, and added a master 'View All Tasks' toggle to the tasks page with an interactive user filter.
