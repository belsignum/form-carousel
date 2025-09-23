<?php
defined('TYPO3') or die();
use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;
call_user_func(function () {
    // PageTSConfig immer global laden
    \TYPO3\CMS\Core\Utility\ExtensionManagementUtility::addPageTSConfig(
        "@import 'EXT:form_carousel/Configuration/TSconfig/form_carousel.tsconfig'"
    );
    ExtensionManagementUtility::addTypoScriptSetup(
        '@import "EXT:form_carousel/Configuration/TypoScript/setup.typoscript"'
    );
});
