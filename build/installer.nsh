; The installer's first page looks like the Windows XP CD welcome screen: build/installer-welcome.bmp
; (tools/installer_art.py) with clickable texts over it.
!include nsDialogs.nsh
!include LogicLib.nsh

!ifndef BUILD_UNINSTALLER
  Var NkUpdateRun
  Var NkWelcomeBitmap
  Var NkOuterW
  Var NkOuterH
  Var NkInL
  Var NkInT
  Var NkInW
  Var NkInH
!endif

!macro NkChrome SHOW
  ; the wizard's header, lines, branding text and buttons (ids of the NSIS 3 dialog)
  GetDlgItem $R7 $HWNDPARENT 1034
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1035
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1036
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1037
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1038
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1039
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1028
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1256
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1045
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 1
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 2
  ShowWindow $R7 ${SHOW}
  GetDlgItem $R7 $HWNDPARENT 3
  ShowWindow $R7 ${SHOW}
!macroend

!macro customWelcomePage
  Page custom NkWelcomeCreate NkWelcomeLeave

  Function NkWelcomeCreate
    IfSilent 0 +2
    Abort
    ; remember the wizard's size and the page area, then make the window the size of the picture without the wizard's chrome
    System::Alloc 16
    Pop $R9
    System::Call 'user32::GetWindowRect(i $HWNDPARENT, i $R9)'
    System::Call '*$R9(i .R0, i .R1, i .R2, i .R3)'
    IntOp $NkOuterW $R2 - $R0
    IntOp $NkOuterH $R3 - $R1
    GetDlgItem $R8 $HWNDPARENT 1018
    System::Call 'user32::GetWindowRect(i $R8, i $R9)'
    System::Call 'user32::MapWindowPoints(i 0, i $HWNDPARENT, i $R9, i 2)'
    System::Call '*$R9(i .R0, i .R1, i .R2, i .R3)'
    StrCpy $NkInL $R0
    StrCpy $NkInT $R1
    IntOp $NkInW $R2 - $R0
    IntOp $NkInH $R3 - $R1
    System::Free $R9
    !insertmacro NkChrome ${SW_HIDE}
    System::Call 'user32::GetSystemMetrics(i 0) i .R0'
    System::Call 'user32::GetSystemMetrics(i 1) i .R1'
    IntOp $R0 $R0 - 806
    IntOp $R0 $R0 / 2
    IntOp $R1 $R1 - 505
    IntOp $R1 $R1 / 2
    System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i $R0, i $R1, i 806, i 505, i 0x14)'
    GetDlgItem $R8 $HWNDPARENT 1018
    System::Call 'user32::SetWindowPos(i $R8, i 0, i 0, i 0, i 800, i 460, i 0x14)'
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
      Abort
    ${EndIf}
    File "/oname=$PLUGINSDIR\nk-welcome.bmp" "${BUILD_RESOURCES_DIR}\installer-welcome.bmp"
    ${NSD_CreateBitmap} 0 0 100% 100% ""
    Pop $NkWelcomeBitmap
    ${NSD_SetStretchedImage} $NkWelcomeBitmap "$PLUGINSDIR\nk-welcome.bmp" $1

    ; one click handler on the picture: the item under the mouse is found by its place on the picture (800x460)
    ${NSD_OnClick} $NkWelcomeBitmap NkWelcomeClick
    ; hand cursor over the picture
    System::Call 'user32::LoadCursor(i 0, i 32649) i .R0'
    System::Call 'user32::SetClassLong(i $NkWelcomeBitmap, i -12, i $R0)'
    nsDialogs::Show
    ${NSD_FreeImage} $1
  FunctionEnd

  Function NkWelcomeClick
    System::Alloc 8
    Pop $R9
    System::Call 'user32::GetCursorPos(i $R9)'
    System::Call 'user32::ScreenToClient(i $NkWelcomeBitmap, i $R9)'
    System::Call '*$R9(i .R0, i .R1)'
    System::Free $R9
    ${If} $R0 >= 40
    ${AndIf} $R0 < 140
    ${AndIf} $R1 >= 385
    ${AndIf} $R1 < 420
      SendMessage $HWNDPARENT ${WM_CLOSE} 0 0
    ${ElseIf} $R0 >= 235
    ${AndIf} $R0 < 520
      ${If} $R1 >= 212
      ${AndIf} $R1 < 250
        SendMessage $HWNDPARENT 0x408 1 0
      ${ElseIf} $R1 >= 252
      ${AndIf} $R1 < 290
        ExecShell "open" "https://github.com/xKaMikax/nekochat_reloaded/releases"
      ${ElseIf} $R1 >= 292
      ${AndIf} $R1 < 330
        ExecShell "open" "https://github.com/xKaMikax/nekochat_reloaded"
      ${EndIf}
    ${EndIf}
  FunctionEnd

  Function NkWelcomeLeave
    ; back to the wizard's own size and layout for the next pages
    System::Call 'user32::SetWindowPos(i $HWNDPARENT, i 0, i 0, i 0, i $NkOuterW, i $NkOuterH, i 0x16)'
    GetDlgItem $R8 $HWNDPARENT 1018
    System::Call 'user32::SetWindowPos(i $R8, i 0, i $NkInL, i $NkInT, i $NkInW, i $NkInH, i 0x14)'
    !insertmacro NkChrome ${SW_SHOW}
  FunctionEnd
!macroend

; Run with the parameter "Update" (Windows Update in the app does this): nothing is shown. The running app is closed,
; the new version is installed and the app starts again with its Windows Update window open (main.js: --open-update).
!macro NkDetectUpdate
  StrCpy $NkUpdateRun 0
  StrLen $R8 $CMDLINE
  StrCpy $R9 0
  ${While} $R9 < $R8
    StrCpy $R7 $CMDLINE 6 $R9
    ${If} $R7 == "Update"
      StrCpy $NkUpdateRun 1
      ${Break}
    ${EndIf}
    IntOp $R9 $R9 + 1
  ${EndWhile}
!macroend

!macro customInit
  !insertmacro NkDetectUpdate
  ${If} $NkUpdateRun == 1
    SetSilent silent
  ${EndIf}
!macroend

!macro customInstall
  ${If} $NkUpdateRun == 1
    Exec '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --open-update'
  ${EndIf}
!macroend
