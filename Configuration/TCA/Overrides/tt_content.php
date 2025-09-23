<?php

use TYPO3\CMS\Core\Utility\ExtensionManagementUtility;

defined('TYPO3') || die();

call_user_func(function() {
    $fieldEnable = 'tx_formcarousel_enable';
    ExtensionManagementUtility::addTCAcolumns('tt_content', [
        $fieldEnable => [
            'label' => 'LLL:EXT:form_carousel/Resources/Private/Language/locallang_db.xlf:tt_content.tx_formcarousel_enable',
            'exclude' => 1,
            'config' => [
                'type' => 'check',
                'renderType' => 'checkboxToggle',
                'items' => [
                    ['label' => '', 'invertStateDisplay' => false],
                ],
            ],
        ],
    ]);

    ExtensionManagementUtility::addToAllTCAtypes(
        'tt_content',
        $fieldEnable,
        '',
        'after:pi_flexform'
    );

    $GLOBALS['TCA']['tt_content']['types']['list']['subtypes_addlist']['formframework'] ??= '';
    $GLOBALS['TCA']['tt_content']['types']['list']['subtypes_addlist']['formframework']
        .= ',' . $fieldEnable;


    $fieldIndicator = [
        'tx_formcarousel_indicators' => [
            'exclude' => true,
            'label' => 'LLL:EXT:form_carousel/Resources/Private/Language/locallang_db.xlf:tt_content.tx_formcarousel_indicators',
            'description' => 'Choose the type of step indicators for carousel forms',
            'config' => [
                'type' => 'select',
                'renderType' => 'selectSingle',
                'items' => [
                    ['LLL:EXT:form_carousel/Resources/Private/Language/locallang_db.xlf:indicator.none', 'none'],
                    ['LLL:EXT:form_carousel/Resources/Private/Language/locallang_db.xlf:indicator.dots', 'dots'],
                    ['LLL:EXT:form_carousel/Resources/Private/Language/locallang_db.xlf:indicator.progress', 'progress'],
                ],
                'default' => 'dots',
            ],
        ],
    ];

    ExtensionManagementUtility::addTCAcolumns('tt_content', $fieldIndicator);

    // Feld im gleichen Bereich wie tx_formcarousel_enable anzeigen
    ExtensionManagementUtility::addToAllTCAtypes(
        'tt_content',
        'tx_formcarousel_indicators',
        'form_formframework',
        'after:tx_formcarousel_enable'
    );
});
