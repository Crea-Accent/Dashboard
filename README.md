<!-- @format -->

# Project File Management System

## Overview

This repository contains a robust, React-based file management system designed for handling project-specific assets, specifically focusing on technical documentation, schematics, and programming files. Built with Next.js, it features automatic version control, metadata parsing, and role-based access control (RBAC) to streamline collaboration. There is also a file you can reference named public.zip[cite: 1] which contains public assets for the project.

---

## Key Features

- **Automated Versioning & Grouping:** Automatically parses filenames to group related files and sort them by date and revision number. It keeps the workspace clean by hiding older versions behind an expandable toggle.
- **Module Categorization:** Dedicated modules for different file types:
  - **Programmation:** Handles automation and smart home project files (DuoTecno, Niko, Siemens, DALI, Loxone).
  - **Schemas:** Manages technical schematics and diagrams.
  - **Documents:** Handles general project documentation and spreadsheets.
- **Role-Based Access Control (RBAC):** Integrates with `next-auth` and a custom permissions provider to ensure only authorized users (e.g., those with `projects.write` permissions) can upload or edit files.
- **Dynamic UI:** Includes toggleable Grid and List views, smooth animations powered by Framer Motion, and intuitive empty/loading states.
- **Metadata Management:** Users can edit file metadata (Name, Comments, Collaborators) directly from the UI, which automatically updates the underlying file's naming structure.

---

## Tech Stack

- **Framework:** Next.js / React (`'use client'` directives)
- **Authentication:** NextAuth.js
- **Styling:** Tailwind CSS (custom properties like `bg-(--foreground)`)
- **Animations:** Framer Motion
- **Icons:** Lucide React

---

## File Naming Convention

The system relies on a strict filename convention to automatically extract metadata, group files, and determine version history. When a file is uploaded or edited, it is saved using the following structure:

`BaseName__Date__Uploader_Revision__Collaborators__Comment.Extension`

- **BaseName:** The core name of the file (used for grouping).
- **Date:** An 8-digit date string (e.g., `20260810`).
- **Uploader_Revision:** The user who uploaded the file, optionally followed by an underscore and a revision number (e.g., `Initials_1`).
- **Collaborators:** A hyphen-separated list of collaborator initials.
- **Comment:** Any additional notes regarding the specific revision.

_Note: The double underscore (`__`) acts as the primary delimiter for parsing._

---

## Supported File Types

The system filters and accepts specific extensions based on the active module:

### 1. Programmation

- `.zip` (General)
- `.dnc` (DALI)
- `.loxone` (Loxone)
- `.nhc2` (Niko)
- `.lsc` (Siemens)
- _(Directories are auto-detected as DuoTecno)_

### 2. Schemas

- `.pdf`
- `.schrack`
- `.trik`
- `.xls`, `.xlsx`, `.xlsm`
- `.txt`

### 3. Documents

- `.pdf`
- `.doc`, `.docx`
- `.xls`, `.xlsx`, `.xlsm`
- `.txt`

---

## Component Structure

- `Programmation.tsx`: Handles automation code uploads and auto-categorizes them by manufacturer.
- `Schemas.tsx`: Manages technical drawings, grouping them by the base file name and extension.
- `Documents.tsx`: Manages standard project text and spreadsheet documents.
- **Shared UI Components:** `FileGrid`, `FileList`, `FileEditModal`, `FileUploadModal`, `ViewToggle`, `EmptyState`, and `Loading`.
